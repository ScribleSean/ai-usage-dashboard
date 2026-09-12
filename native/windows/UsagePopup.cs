using System.Drawing.Drawing2D;
using System.Globalization;
using System.Text.Json.Nodes;

namespace WorkspaceObservatory;

internal sealed class UsagePopup : Form
{
    private readonly Func<JsonObject?> read;
    private readonly Func<Task> refresh;
    private readonly Action open;
    private readonly FlowLayoutPanel content = new() { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false, AutoScroll = false, Padding = new Padding(14) };
    private string host = "Windows";
    private const int BodyWidth = 360;

    internal UsagePopup(Func<JsonObject?> read, Func<Task> refresh, Action open)
    {
        this.read = read; this.refresh = refresh; this.open = open;
        Text = "Workspace Observatory";
        AccessibleName = "Workspace Observatory usage overview";
        BackColor = Color.FromArgb(24, 25, 27); ForeColor = Color.WhiteSmoke;
        Font = new Font("Segoe UI", 9);
        ClientSize = new Size(388, 560);
        FormBorderStyle = FormBorderStyle.FixedToolWindow;
        ShowInTaskbar = false; StartPosition = FormStartPosition.Manual;
        Controls.Add(content);
        Reload();
    }

    private Label Label(string text, bool heading = false)
    {
        var label = new Label { Text = text, AutoSize = true, MaximumSize = new Size(BodyWidth, 0),
            Margin = new Padding(0, heading ? 12 : 4, 0, 4), ForeColor = heading ? Color.WhiteSmoke : Color.LightGray };
        if (heading) label.Font = new Font(Font, FontStyle.Bold);
        content.Controls.Add(label); return label;
    }

    internal void Reload()
    {
        if (IsDisposed) return;
        content.SuspendLayout();
        foreach (var control in content.Controls.Cast<Control>().ToArray()) control.Dispose();
        var data = read();
        Label("WORKSPACE OBSERVATORY", true);
        var quota = data?["quota"] as JsonObject;
        if (Snapshot.Text(quota?["status"]) != "not-connected" && quota is not null)
        {
            Label("Codex account usage", true);
            var status = Snapshot.Text(quota["status"]);
            Label(Snapshot.Text(quota["latestReadStatus"]) == "waiting" ? "Waiting for the next permitted usage check." : status switch { "ok" => "Latest reading", "stale" => "Saved reading. A fresh check is pending.",
                "needs-auth" => "Sign in through Codex, then refresh.", "unsupported" => "This Codex client or account does not report limits.",
                _ => "Limits unavailable. Check Codex or try again later." });
            if (DateTimeOffset.TryParse(Snapshot.Text(quota["checkedAt"]), out var at)) Label($"Last read {at.ToLocalTime():g}");
            var windows = (quota["windows"] as JsonArray)?.OfType<JsonObject>()
                .Where(row => !new[] { "codex_bengalfox", "codex_spark", "spark" }.Contains(Snapshot.Text(row["bucket"]), StringComparer.OrdinalIgnoreCase)).ToArray() ?? [];
            foreach (var window in windows.Take(2))
            {
                Label($"{WindowLabel(window)}    {Snapshot.Format(Snapshot.Number(window["remainingPercent"]))}% left");
                content.Controls.Add(new ProgressBar { Width = BodyWidth, Height = 8, Maximum = 1000,
                    Value = (int)Math.Clamp((Snapshot.Number(window["remainingPercent"]) ?? 0) * 10, 0, 1000),
                    AccessibleName = WindowLabel(window) + " remaining allowance", Margin = new Padding(0, 0, 0, 4) });
            }
            if (windows.Length > 2) Label($"{windows.Length - 2} more allowance windows in Observatory");
            Label("Account-wide limits, not a device sum.");
        }
        else Label("Account limits are off. Enable optional account usage in Configure local collection.");
        Label("Latest local records", true);
        var hosts = new ComboBox { Width = BodyWidth, DropDownStyle = ComboBoxStyle.DropDownList, AccessibleName = "Source host" };
        hosts.Items.AddRange(new object[] { "All", "Mac", "Windows", "Ubuntu" }); hosts.SelectedItem = host;
        hosts.SelectedIndexChanged += (_, _) => { host = (string)hosts.SelectedItem!; Reload(); };
        content.Controls.Add(hosts);
        var activity = Snapshot.Latest(data, "activity", host);
        var tokens = Snapshot.Latest(data, "tokens", host);
        Label($"Active time: {Snapshot.Duration(Snapshot.Number(activity?["seconds"]))} · {Snapshot.Text(activity?["date"])}");
        Label($"Tokens: {Snapshot.Format(Snapshot.Number(tokens?["totalTokens"]))} · {Snapshot.Text(tokens?["date"])}");
        var refreshButton = new Button { Text = "Refresh sources", Width = BodyWidth, Height = 30, AccessibleName = "Refresh sources" };
        refreshButton.Click += async (_, _) => { refreshButton.Enabled = false; try { await refresh(); } finally { if (!IsDisposed) Reload(); } };
        content.Controls.Add(refreshButton);
        var openButton = new Button { Text = "Open Observatory", Width = BodyWidth, Height = 30 };
        openButton.Click += (_, _) => { Close(); open(); }; content.Controls.Add(openButton);
        content.ResumeLayout();
        // Size the native surface around its controls instead of hiding navigation
        // below a scroll area. Screen constraints are applied by ShowNearTray.
        var preferred = content.GetPreferredSize(new Size(ClientSize.Width, 0));
        ClientSize = new Size(ClientSize.Width, preferred.Height);
    }

    private static string WindowLabel(JsonObject row)
    {
        var minutes = Snapshot.Number(row["durationMinutes"]);
        var duration = minutes is null ? Snapshot.Text(row["window"]) : minutes >= 1440 ? $"{minutes / 1440:0.#}d" : minutes >= 60 ? $"{minutes / 60:0.#}h" : $"{minutes:0.#}m";
        return Snapshot.Text(row["bucket"]) + " · " + duration;
    }

    internal void ShowNearTray()
    {
        var area = Screen.FromPoint(Cursor.Position).WorkingArea;
        Height = Math.Min(Height, area.Height - 24); Width = Math.Min(Width, area.Width - 24);
        Location = new Point(Math.Clamp(Cursor.Position.X - Width, area.Left, area.Right - Width),
            Math.Clamp(Cursor.Position.Y - Height, area.Top, area.Bottom - Height));
        Show(); Activate();
    }
}

internal sealed class QuotaGraph : Control
{
    private readonly JsonObject quota;
    private JsonObject window;
    internal QuotaGraph(JsonObject quota, JsonObject window)
    {
        this.quota = quota; this.window = window;
        DoubleBuffered = true; ForeColor = Color.WhiteSmoke; BackColor = Color.FromArgb(24, 25, 27);
        AccessibleName = "Allowance history. Gaps and resets are separate segments.";
        AccessibleRole = AccessibleRole.Graphic;
    }
    internal void SelectWindow(JsonObject next) { window = next; Invalidate(); }
    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
        using var grid = new Pen(Color.FromArgb(65, 66, 68)); using var line = new Pen(Color.WhiteSmoke, 1.5f);
        using var brush = new SolidBrush(Color.LightGray);
        var box = new RectangleF(34, 12, Math.Max(1, Width - 44), Math.Max(1, Height - 42));
        foreach (var percent in new[] { 0, 50, 100 })
        {
            var y = box.Bottom - box.Height * percent / 100;
            g.DrawLine(grid, box.Left, y, box.Right, y); g.DrawString(percent + "%", Font, brush, 0, y - 6);
        }
        if (!DateTimeOffset.TryParse(Snapshot.Text(quota["checkedAt"]), out var end)) return;
        var start = end.AddDays(-1);
        g.DrawString(start.ToLocalTime().ToString("HH:mm"), Font, brush, box.Left, box.Bottom + 6);
        g.DrawString(end.ToLocalTime().ToString("HH:mm"), Font, brush, box.Right - 38, box.Bottom + 6);
        PointF? previous = null; DateTimeOffset? previousAt = null; double? previousUsed = null; string? previousReset = null;
        var count = 0;
        double? firstUsed = null, lastUsed = null, minimumUsed = null, maximumUsed = null;
        foreach (var sample in (quota["history"] as JsonArray)?.OfType<JsonObject>() ?? [])
        {
            var row = (sample["windows"] as JsonArray)?.OfType<JsonObject>().FirstOrDefault(item =>
                Snapshot.Text(item["bucket"]) == Snapshot.Text(window["bucket"]) && Snapshot.Text(item["window"]) == Snapshot.Text(window["window"]));
            if (!DateTimeOffset.TryParse(Snapshot.Text(sample["checkedAt"]), out var at) || at < start || at > end ||
                Snapshot.Number(row?["remainingPercent"]) is not double remaining || remaining > 100)
            { previous = null; previousAt = null; continue; }
            var used = 100 - remaining; var reset = Snapshot.Text(row?["resetsAt"]);
            var point = new PointF(box.Left + box.Width * (float)((at - start).TotalSeconds / 86400), box.Bottom - box.Height * (float)(used / 100));
            if (previous is PointF prior && previousAt is DateTimeOffset time && at > time && (at - time).TotalSeconds <= 600 && used >= previousUsed && reset == previousReset)
                g.DrawLine(line, prior, point);
            g.FillEllipse(brush, point.X - 2, point.Y - 2, 4, 4);
            firstUsed ??= used; lastUsed = used;
            minimumUsed = Math.Min(minimumUsed ?? used, used); maximumUsed = Math.Max(maximumUsed ?? used, used);
            previous = point; previousAt = at; previousUsed = used; previousReset = reset; count++;
        }
        var selection = Snapshot.Text(window["bucket"]) + " " + Snapshot.Text(window["window"]);
        AccessibleDescription = count == 0 ? $"{selection}: no observations in this 24-hour period."
            : $"{selection}: {count} observations. Allowance used starts at {firstUsed:0.#}%, ends at {lastUsed:0.#}%, and ranges from {minimumUsed:0.#}% to {maximumUsed:0.#}%. Gaps and resets are not joined.";
    }
}

internal sealed class DailyTokenGraph : Control
{
    private readonly JsonObject quota;
    internal DailyTokenGraph(JsonObject quota)
    {
        this.quota = quota; DoubleBuffered = true; BackColor = Color.FromArgb(24, 25, 27);
        AccessibleName = "Recent daily account token totals. Missing dates are unknown, not zero.";
        AccessibleRole = AccessibleRole.Graphic;
    }
    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        var values = ((quota["dailyUsageBuckets"] as JsonArray)?.OfType<JsonObject>() ?? [])
            .Select(row => (date: DateOnly.TryParseExact(Snapshot.Text(row["startDate"]), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var day) ? day : (DateOnly?)null,
                tokens: Snapshot.Number(row["tokens"]))).Where(row => row.date is not null && row.tokens is not null).TakeLast(14).ToArray();
        if (values.Length == 0) return;
        var start = values.Min(row => row.date!.Value.DayNumber); var end = values.Max(row => row.date!.Value.DayNumber);
        var maximum = Math.Max(1, values.Max(row => row.tokens!.Value));
        var box = new RectangleF(44, 12, Math.Max(1, Width - 54), Math.Max(1, Height - 42));
        using var brush = new SolidBrush(Color.LightGray); using var grid = new Pen(Color.FromArgb(65, 66, 68));
        e.Graphics.DrawLine(grid, box.Left, box.Bottom, box.Right, box.Bottom);
        e.Graphics.DrawString(Snapshot.Format(maximum), Font, brush, 0, box.Top);
        foreach (var row in values)
        {
            var slot = box.Width / (end - start + 1); var height = (float)(row.tokens!.Value / maximum) * box.Height;
            var x = box.Left + slot * (row.date!.Value.DayNumber - start);
            e.Graphics.FillRectangle(brush, x + slot * 0.15f, box.Bottom - height, Math.Max(1, slot * 0.7f), height);
        }
        e.Graphics.DrawString(DateOnly.FromDayNumber(start).ToString("MM-dd"), Font, brush, box.Left, box.Bottom + 6);
        e.Graphics.DrawString(DateOnly.FromDayNumber(end).ToString("MM-dd"), Font, brush, box.Right - 38, box.Bottom + 6);
        AccessibleDescription = string.Join(". ", values.Select(row => $"{row.date:yyyy-MM-dd}: {Snapshot.Format(row.tokens)} tokens"));
    }
}
