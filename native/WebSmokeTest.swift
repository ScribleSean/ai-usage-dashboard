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
            let view = makeDashboard(runtime: runtime, resources: resources)
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
            return object.smokeTest === true && denied && window.observatoryBundleReady === true
              && views?.getAttribute('aria-orientation') === 'vertical';
            """, arguments: [:], in: nil, contentWorld: .page)
            finish(value as? Bool == true)
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
