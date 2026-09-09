using System.Diagnostics;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace WorkspaceObservatory;

internal sealed class Collector : IDisposable
{
    private readonly string runtime;
    private readonly System.Windows.Forms.Timer timer = new() { Interval = 300000 };
    private readonly CancellationTokenSource lifetime = new();
    private bool busy;
    internal event Action? Changed;

    internal Collector(string runtime)
    {
        this.runtime = runtime;
        Directory.CreateDirectory(Path.Combine(runtime, "public", "local"));
        timer.Tick += async (_, _) => await Refresh();
    }

    internal void Start() { timer.Start(); _ = Refresh(); }
    internal bool Configured => File.Exists(Path.Combine(runtime, "collector.config.json"));

    internal void Configure(string? distro, bool wispr = false)
    {
        if (distro is not null && !Regex.IsMatch(distro, "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")) throw new ArgumentException("Invalid distribution");
        var file = Path.Combine(runtime, "collector.config.json");
        var settings = new JsonObject { ["activity"] = true, ["codex"] = true, ["wispr"] = wispr, ["wslDistribution"] = distro };
        File.WriteAllText(file + ".tmp", settings.ToJsonString());
        File.Move(file + ".tmp", file, true);
    }

    internal string? Distribution => Snapshot.Read(Path.Combine(runtime, "collector.config.json"))?["wslDistribution"]?.GetValue<string>();

    internal async Task Refresh()
    {
        if (busy || !Configured || lifetime.IsCancellationRequested) return;
        busy = true;
        try
        {
            // Serialize app and command-line collection without relying on a stale PID file.
            using var locked = new FileStream(Path.Combine(runtime, "collection.lock"), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
            var node = Path.Combine(AppContext.BaseDirectory, "Runtime", "node.exe");
            if (!File.Exists(node)) node = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs", "node.exe");
            var script = Path.Combine(AppContext.BaseDirectory, "Collector", "scripts", "collect-windows.mjs");
            if (!File.Exists(node) || !File.Exists(script)) throw new InvalidOperationException("Collector runtime unavailable");
            using var process = new Process { StartInfo = new ProcessStartInfo(node)
                { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true } };
            process.StartInfo.ArgumentList.Add(script);
            process.StartInfo.Environment["OBSERVATORY_RUNTIME"] = runtime;
            var python = Path.Combine(AppContext.BaseDirectory, "Runtime", "python", "python.exe");
            if (File.Exists(python)) process.StartInfo.Environment["OBSERVATORY_PYTHON"] = python;
            process.Start();
            var output = process.StandardOutput.ReadToEndAsync();
            var error = process.StandardError.ReadToEndAsync();
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(lifetime.Token);
            timeout.CancelAfter(TimeSpan.FromSeconds(240));
            try { await process.WaitForExitAsync(timeout.Token); }
            catch { if (!process.HasExited) process.Kill(entireProcessTree: true); throw; }
            await Task.WhenAll(output, error);
            if (process.ExitCode != 0) throw new InvalidOperationException("Collection failed");
        }
        catch (IOException) { /* An existing collector or unavailable storage remains visible through freshness. */ }
        catch
        {
            try
            {
                var file = Path.Combine(runtime, "public", "local", "collector.json");
                var status = new JsonObject { ["state"] = "failed", ["finishedAt"] = DateTimeOffset.UtcNow.ToString("O"), ["intervalSeconds"] = 300 };
                File.WriteAllText(file + ".tmp", status.ToJsonString()); File.Move(file + ".tmp", file, true);
            }
            catch { }
        }
        finally { busy = false; if (!lifetime.IsCancellationRequested) Changed?.Invoke(); }
    }

    public void Dispose() { timer.Stop(); timer.Dispose(); lifetime.Cancel(); lifetime.Dispose(); }
}
