import AppKit
import WebKit

// Exercises the bundled renderer and narrow data bridge with synthetic data, without a window.
@MainActor
final class WebSmokeTest: NSObject, WKNavigationDelegate {
    private var web: WKWebView?
    private var timer: Timer?
    private let runtime = FileManager.default.temporaryDirectory.appendingPathComponent("observatory-smoke-\(UUID().uuidString)")
    func start() {
        do {
            let local = runtime.appendingPathComponent("public/local")
            try FileManager.default.createDirectory(at: local, withIntermediateDirectories: true)
            let synthetic: JSONObject = ["schema": 2, "collectedAt": "2026-09-08T12:00:00Z", "demo": true,
                "activity": [], "tokens": [], "agents": [], "dictation": [], "smokeTest": true]
            try JSONSerialization.data(withJSONObject: synthetic).write(to: local.appendingPathComponent("usage.json"))
            try JSONSerialization.data(withJSONObject: ["state": "ok"]).write(to: local.appendingPathComponent("collector.json"))
            guard let resources = Bundle.main.resourceURL else { finish(false); return }
            let testResources = runtime.appendingPathComponent("resources")
            try FileManager.default.createDirectory(at: testResources, withIntermediateDirectories: true)
            try FileManager.default.copyItem(at: resources.appendingPathComponent("Web"), to: testResources.appendingPathComponent("Web"))
            for base in [runtime, testResources.appendingPathComponent("Web"), testResources.appendingPathComponent("Web/assets")] {
                let directory = base.appendingPathComponent("private-sync")
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                for name in ["pairing.json", "setup.pending.json"] {
                    try Data("{\"privateCanary\":true}".utf8).write(to: directory.appendingPathComponent(name))
                }
            }
            try Data("// synthetic private canary".utf8).write(to: runtime.appendingPathComponent("private-sync/secret.js"))
            try FileManager.default.createSymbolicLink(at: testResources.appendingPathComponent("Web/assets/private-linked"),
                withDestinationURL: runtime.appendingPathComponent("private-sync"))
            let view = makeDashboard(runtime: runtime, resources: testResources)
            view.frame = NSRect(x: 0, y: 0, width: 1100, height: 760)
            view.navigationDelegate = self
            web = view
            timer = Timer.scheduledTimer(withTimeInterval: 25, repeats: false) { [weak self] _ in
                MainActor.assumeIsolated { self?.finish(false) }
            }
            view.load(URLRequest(url: URL(string: "observatory://app/index.html")!))
        } catch { finish(false) }
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        Task {
          do {
            let value = try await webView.callAsyncJavaScript("""
            const response = await fetch('./local/usage.json');
            const object = await response.json();
            let privateDenied = true;
            for (const path of ['./private-sync/pairing.json', './private-sync/setup.pending.json',
              './assets/private-sync/pairing.json', './assets/private-sync/setup.pending.json',
              './assets/private-linked/secret.js',
              './assets/%2e%2e/private-sync/setup.pending.json', './local/../private-sync/pairing.json']) {
              try { const r = await fetch(path); if (r.ok) privateDenied = false; } catch {}
            }
            for (const name of ['private-sync/pairing', '../private-sync/setup.pending', 'setup.pending', 'pairing']) {
              try { await window.webkit.messageHandlers.snapshot.postMessage(name); privateDenied = false; } catch {}
            }
            let denied = false;
            try { await window.webkit.messageHandlers.snapshot.postMessage('../native-runtime'); }
            catch { denied = true; }
            // React mounts asynchronously. Verify the primitive's actual semantics,
            // not only the CSS orientation attribute on its wrapper.
            let views;
            for (let attempt = 0; attempt < 100; attempt++) {
              views = document.querySelector('[role="tablist"][aria-label="Usage views"]');
              if (views?.getAttribute('aria-orientation') === 'vertical') break;
              await new Promise(resolve => setTimeout(resolve, 50));
            }
            return object.smokeTest === true && denied && privateDenied && window.observatoryBundleReady === true
              && views?.getAttribute('aria-orientation') === 'vertical';
            """, arguments: [:], in: nil, contentWorld: .page)
            guard value as? Bool == true else { finish(false); return }
            let local = runtime.appendingPathComponent("public/local")
            let privateDirectory = runtime.appendingPathComponent("private-sync")
            let collector = local.appendingPathComponent("collector.json")
            try FileManager.default.removeItem(at: collector)
            try FileManager.default.createSymbolicLink(at: collector, withDestinationURL: privateDirectory.appendingPathComponent("pairing.json"))
            let fileDenied = try await webView.callAsyncJavaScript("""
            try { await window.webkit.messageHandlers.snapshot.postMessage('collector'); return false; }
            catch { return true; }
            """, arguments: [:], in: nil, contentWorld: .page)
            guard fileDenied as? Bool == true else { finish(false); return }
            try FileManager.default.removeItem(at: local)
            try Data("{\"privateCanary\":true}".utf8).write(to: privateDirectory.appendingPathComponent("usage.json"))
            try FileManager.default.createSymbolicLink(at: local, withDestinationURL: privateDirectory)
            let parentDenied = try await webView.callAsyncJavaScript("""
            try { await fetch('./local/usage.json'); return false; }
            catch { return true; }
            """, arguments: [:], in: nil, contentWorld: .page)
            finish(parentDenied as? Bool == true)
          } catch { finish(false) }
        }
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { finish(false) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { finish(false) }
    private func finish(_ passed: Bool) {
        timer?.invalidate()
        web?.stopLoading()
        web?.configuration.userContentController.removeAllScriptMessageHandlers()
        web = nil
        try? FileManager.default.removeItem(at: runtime)
        print(passed ? "Native renderer and data bridge passed" : "Native renderer or data bridge failed")
        exit(passed ? 0 : 1)
    }
}
