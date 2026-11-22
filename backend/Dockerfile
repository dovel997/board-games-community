# Build: docker build -t board-games-api --build-arg APP_VERSION=local backend
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first so this layer is cached until the project file changes.
COPY src/BoardGames.Api/BoardGames.Api.csproj src/BoardGames.Api/
RUN dotnet restore src/BoardGames.Api/BoardGames.Api.csproj

COPY src/ src/
RUN dotnet publish src/BoardGames.Api/BoardGames.Api.csproj \
    -c Release -o /app/publish --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION \
    ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_HTTP_PORTS=8080
WORKDIR /app
COPY --from=build /app/publish .

# Run as the non-root user that the .NET images provide.
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "BoardGames.Api.dll"]
