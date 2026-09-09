using System.Text.Json.Nodes;

namespace WorkspaceObservatory;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        if (args.Contains("--self-test"))
        {
            try { Snapshot.SelfTest(); LoginStartup.SelfTest(); }
            catch (Exception error) { Console.Error.WriteLine(error.Message); Environment.ExitCode = 1; }
            return;
        }
        if (args.Length == 2 && args[0] == "--collect-once")
        {
            if (!Path.IsPathFullyQualified(args[1]) || !Directory.Exists(args[1])) { Environment.ExitCode = 1; return; }
            using var collector = new Collector(args[1]);
            collector.Refresh().GetAwaiter().GetResult();
            var state = Snapshot.Text(Snapshot.Read(Path.Combine(args[1], "public", "local", "collector.json"))?["state"]);
            Console.WriteLine(state);
            Environment.ExitCode = state is "ok" or "partial" ? 0 : 1;
            return;
        }
        ApplicationConfiguration.Initialize();
        if (args.Length == 2 && args[0] == "--test-web")
        {
            if (!Path.IsPathFullyQualified(args[1]) || !Directory.Exists(args[1])) { Environment.ExitCode = 1; return; }
            Application.Run(new Dashboard(args[1], smokeTest: true));
            return;
        }
        using var singleton = new Mutex(true, "Local\\WorkspaceObservatory", out var first);
        if (!first) return;
        Application.Run(new ObservatoryContext());
    }
}

internal sealed class ObservatoryContext : ApplicationContext
{
    private readonly string runtime = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Workspace Observatory");
    private readonly NotifyIcon tray;
    private readonly Collector collector;
    private Dashboard? dashboard;
    private readonly System.Windows.Forms.Timer timer = new() { Interval = 30000 };

    internal ObservatoryContext()
    {
        Directory.CreateDirectory(runtime);
        collector = new Collector(runtime);
        var menu = new ContextMenuStrip();
        menu.Items.Add("Open Observatory", null, (_, _) => Open());
        menu.Items.Add("Refresh sources", null, async (_, _) => await collector.Refresh());
        menu.Items.Add("Configure local collection", null, (_, _) => Configure());
        var startup = new ToolStripMenuItem("Register start at login");
        menu.Items.Add(startup);
        menu.Opening += (_, _) =>
        {
            try { startup.Checked = LoginStartup.Registered(); startup.Enabled = true; }
            catch { startup.Checked = false; startup.Enabled = false; }
        };
        startup.Click += (_, _) =>
        {
            try
            {
                LoginStartup.SetRegistered(!LoginStartup.Registered());
                startup.Checked = LoginStartup.Registered();
            }
            catch (Exception error) when (error is InvalidOperationException or ArgumentException)
            { MessageBox.Show(error.Message, "Login startup", MessageBoxButtons.OK, MessageBoxIcon.Warning); }
            catch { MessageBox.Show("Windows could not update startup registration. Check your account permissions.", "Login startup", MessageBoxButtons.OK, MessageBoxIcon.Warning); }
        };
        var totals = new ToolStripMenuItem("Latest recorded totals");
        foreach (var host in new[] { "All", "Mac", "Windows", "Ubuntu" })
            totals.DropDownItems.Add(host, null, (_, _) => ShowTotals(host));
        menu.Items.Add(totals);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Quit Observatory", null, (_, _) => ExitThread());
        tray = new NotifyIcon { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath) ?? SystemIcons.Application,
            Text = "Workspace Observatory", ContextMenuStrip = menu, Visible = true };
        tray.DoubleClick += (_, _) => Open();
        timer.Tick += (_, _) => RefreshStatus();
        timer.Start();
        RefreshStatus();
        collector.Changed += RefreshStatus;
        if (collector.Configured) collector.Start();
    }

    private JsonObject? Data() => Snapshot.Read(Path.Combine(runtime, "public", "local", "usage.json"));

    private void Configure()
    {
        var answer = MessageBox.Show("Enable local ActivityWatch and saved Codex usage collection? Only approved usage metadata enters the dashboard, not prompts or window titles.",
            "Workspace Observatory", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
        if (answer != DialogResult.Yes) return;
        var wsl = MessageBox.Show("Also collect Ubuntu logs? This starts the installed Ubuntu WSL distribution in the background when collecting, without an open terminal. Choose No for Windows-only collection.",
            "Ubuntu collection", MessageBoxButtons.YesNo, MessageBoxIcon.Question) == DialogResult.Yes;
        var wispr = MessageBox.Show("Include Wispr Flow word counts and recorded audio duration? Transcripts and recordings are not read.",
            "Optional dictation statistics", MessageBoxButtons.YesNo, MessageBoxIcon.Question) == DialogResult.Yes;
        collector.Configure(wsl ? "Ubuntu" : null, wispr);
        collector.Start();
    }

    private void RefreshStatus()
    {
        var stamp = Snapshot.Text(Data()?["collectedAt"], "");
        tray.Text = DateTimeOffset.TryParse(stamp, out var at)
            ? $"Observatory · updated {Math.Max(0, (int)(DateTimeOffset.UtcNow - at).TotalMinutes)}m ago"
            : "Observatory · waiting for first snapshot";
    }

    private void ShowTotals(string host)
    {
        var data = Data();
        var activity = Snapshot.Latest(data, "activity", host);
        var tokens = Snapshot.Latest(data, "tokens", host);
        var message = $"Active time: {Snapshot.Duration(Snapshot.Number(activity?["seconds"]))}\n" +
            $"Recorded date: {Snapshot.Text(activity?["date"])}\n\n" +
            $"Tokens: {Snapshot.Format(Snapshot.Number(tokens?["totalTokens"]))}\n" +
            $"Recorded date: {Snapshot.Text(tokens?["date"])}";
        if (host == "All") message += "\n\nOnly verified combined totals are shown. WSL screen time is part of Windows.";
        MessageBox.Show(message, $"Workspace Observatory · {host}", MessageBoxButtons.OK, MessageBoxIcon.Information);
    }

    private void Open()
    {
        if (dashboard is null || dashboard.IsDisposed)
        {
            dashboard = new Dashboard(runtime);
            dashboard.FormClosed += (_, _) => dashboard = null;
        }
        dashboard.Show();
        if (dashboard.WindowState == FormWindowState.Minimized) dashboard.WindowState = FormWindowState.Normal;
        dashboard.Activate();
    }

    protected override void ExitThreadCore()
    {
        timer.Stop(); timer.Dispose(); collector.Dispose(); dashboard?.Close(); tray.Visible = false; tray.Dispose();
        base.ExitThreadCore();
    }
}
