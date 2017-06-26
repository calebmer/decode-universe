# Decode Studio Desktop

The desktop studio application. Built with Electron to allow for code sharing across web and desktop.

### Opening a Specific Room

If you want to open Decode Studio and immeadiately join a specific room instead of the recordings directory then set the `INITIAL_ROOM` environment variable to any string. This useful when hacking on the studio room, or when you want to connect your browser to a consistent room in development. The `INITIAL_ROOM` option is only respected if you are building for development. Following is an example that uses `INITIAL_ROOM` with the popular development room `dev`:

```bash
INITIAL_ROOM=dev ./workflow dev ./studio/desktop
```
