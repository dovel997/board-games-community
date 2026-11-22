using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.HttpOverrides;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHealthChecks();

// The API runs behind nginx. Only nginx can reach the container (port is bound to
// 127.0.0.1 on the VPS), so trust the forwarded headers it sends.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

var app = builder.Build();

app.UseForwardedHeaders();

// Set by the Docker build (git commit SHA) so you can see which version is deployed.
var version = app.Configuration["APP_VERSION"] ?? "dev";

app.MapHealthChecks("/api/health", new HealthCheckOptions
{
    ResponseWriter = (context, report) =>
    {
        context.Response.ContentType = "application/json";
        return context.Response.WriteAsync(JsonSerializer.Serialize(new
        {
            status = report.Status.ToString(),
            version,
            environment = app.Environment.EnvironmentName,
            time = DateTimeOffset.UtcNow,
        }));
    },
});

app.Run();

// Makes the Program class visible to the integration tests (WebApplicationFactory).
public partial class Program;
