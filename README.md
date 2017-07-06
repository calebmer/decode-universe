# Decode Universe

The universe of all digital assets used in building, maintaining, and distributing Decode products.

## Setup

We try to make it very easy to get started working in universe. Just run the following:

```bash
./__workflow__/bin/setup
```

…and you should be good to go to start working in any of the workspaces in universe.

### Running Studio Web

There are a few steps involved in running Decode Studio Web at the moment. Hopefully in the future it will be down to a single command.

First, you need to start the signaling server:

```bash
./workflow dev ./studio/signal/server
```

Then you need to open a new tab in your terminal and start the dev server for studio web:

```bash
./workflow dev ./studio/web
```

This should open up a tab in your web browser that points to http://localhost:9020/. To join a room add the text `?room=dev` to the end of the url for a full url of: http://localhost:9020/?room=dev.

### Running Studio Desktop

Similarly, we also want to get running Decode Studio Desktop down to a single command.

If the signaling server is not already running you need to start it:

```bash
./workflow dev ./studio/signal/server
```

Then start the dev server and Electron process for the desktop app:

```bash
./workflow dev ./studio/desktop
```

This will open an Electron app running Decode Studio Desktop.

## Workspaces

The universe repository contains all of the code used to run Decode services. Instead of using many smaller version controlled repositories we believe that it is easier to test, teach, and develop in one repository. With a monorepo we can centralize development tools and any improvements to the process effects all developers. Note that just because we have monorepo does not mean we exclusively want a monolithic backend architecture. Microservices should certainly be built where it makes sense, they are just built alongside the rest of Decode code.

Universe is organized into “workspaces.” Each workspace can be identified as it has a `workspace.json` file and usually a `README.md` as well. Workspaces are configured in their `workspace.json` file with a `target` which specifies where the workspace’s code is intended to be used, an array of `dependencies` which lists both universe dependencies (paths absolute to the universe root starting with `~`) in addition to external dependencies (the versions of which are global and can be found in the root `package.json`), and some other configuration options where appropriate. Workspaces cannot be nested, but may depend on one another.

Start exploring the universe folder structure and you will quickly find a workspace.

## Workflow

We have built specialized tools to help us develop in the universe monorepo. The goal of these tools is to keep the development process fast, enjoyable, and feature rich.

Since all our code is shared JavaScript that needs to deploy to many different places (any web browser, Node.js, Electron) no standard open source tool can meet our unique needs. So we developed a workflow tool that combines standard open source tools to make up our workflow. The code four our workflow is not complex and we encourage you to contribute to it whenever you see a way to make development across all Decode properties better. Improvements to the workflow tool are always appreciated by all.

The workflow tool entry point lives at `__workflow__/bin/workflow`, but to make it more accessible we provide an alias file at the root of universe named simply `workflow`.

To see the capabilities of the workflow tool run:

```bash
./workflow -h
```

*(Make sure you have setup universe first!)*

Whenever the workflow tool asks for a workspace it wants the path to a workspace in universe. For example to specify the studio web workspace you would pass in `./studio/web`. The workflow tool will see the `workspace.json` file and use that workspace.

The commands you will use most often are as follows:

- **`dev <workspace>`:** This command intends to be the all-in-one entrypoint to a fast and delightful development experience. It takes a single workspace and launches the development environment. Follow the instructions in the output to see the result. (Example: `./workflow dev ./studio/web` launches the Webpack Dev Server for Studio Web and opens the web page in your browser. Another example is `./workflow dev ./studio/desktop` which will launch a Webpack Dev Server and Electron.)
- **`check [workspaces...]`:** Performs a formal type check of the workspaces listed in the arguments. (All workspaces if no arguments were provided.) There may be more errors listed after this check then can be seen in your code editor. This is because in editors we treat all of universe as a single project, but in formal checking we use a different project configuration for every workspace customized based on the target and dependencies.
