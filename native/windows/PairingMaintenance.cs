using System.Diagnostics;

namespace WorkspaceObservatory;

internal static class PairingMaintenance
{
    internal static async Task Disconnect(string runtime, CancellationToken cancellation = default)
    {
        if (!Path.IsPathFullyQualified(runtime) || !Directory.Exists(runtime) ||
            (File.GetAttributes(runtime) & FileAttributes.ReparsePoint) != 0)
            throw new InvalidOperationException("Private runtime unavailable.");
        var node = Path.Combine(AppContext.BaseDirectory, "Runtime", "node.exe");
        var script = Path.Combine(AppContext.BaseDirectory, "Collector", "scripts", "peer-revocation.mjs");
        if (!File.Exists(node) || !File.Exists(script)) throw new InvalidOperationException("Bundled pairing tools unavailable.");
        using var process = new Process { StartInfo = new ProcessStartInfo(node)
            { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true } };
        foreach (var argument in new[] { script, "--runtime", Path.GetFullPath(runtime), "--revoke" })
            process.StartInfo.ArgumentList.Add(argument);
        process.Start();
        var output = process.StandardOutput.ReadToEndAsync();
        var error = process.StandardError.ReadToEndAsync();
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation);
        timeout.CancelAfter(TimeSpan.FromSeconds(20));
        try { await process.WaitForExitAsync(timeout.Token); }
        catch
        {
            if (!process.HasExited) process.Kill(entireProcessTree: true);
            await process.WaitForExitAsync();
            throw;
        }
        await Task.WhenAll(output, error);
        if (process.ExitCode != 0) throw new InvalidOperationException("Private pairing revocation could not be verified.");
    }

    internal static void SelfTest()
    {
        var runtime = Path.Combine(Path.GetTempPath(), "observatory-pairing-native-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(runtime);
        try
        {
            var sentinel = Path.Combine(runtime, "synthetic-sentinel.txt");
            File.WriteAllText(sentinel, "preserve");
            Disconnect(runtime).GetAwaiter().GetResult();
            Disconnect(runtime).GetAwaiter().GetResult();
            if (!File.Exists(Path.Combine(runtime, "private-sync", "revoked")) || File.ReadAllText(sentinel) != "preserve")
                throw new InvalidOperationException("Native pairing revocation self-test failed.");
            Console.WriteLine("Native pairing revocation self-test passed with temporary data.");
        }
        finally { Directory.Delete(runtime, recursive: true); }
    }
}
