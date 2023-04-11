# Overview

TC Portal is the UID2 Transparency and Control Portal. It allows consumers to opt out of targeted advertising via UID2 and EUID.

The UID 2 Project is subject to Tech Lab IPR’s Policy and is managed by the IAB Tech Lab Addressability Working Group and Privacy & Rearc Commit Group. Please review the governance rules [here](https://github.com/IABTechLab/uid2-core/blob/master/Software%20Development%20and%20Release%20Procedures.md)

# Developer guide

## Prerequisites

- Node 14.x
- Yarn 1.x: `npm install --global yarn`
- You will need to have [UID2 Operator](https://github.com/IABTechLab/uid2-operator) running somewhere in order to submit opt-outs.
-- Operator runs on port 8080 by default. If you provide the `port_offset` environment variable, it will add that value to the port it uses (e.g. with `port_offset=1200` it will run on port 9280).

## IDE

For translation support, use VS Code with the `i18n Ally` extension by Lokalise (it should be recommended when you open the project).

## Configuration

Create a file called `.env` in this folder. Variables defined in this file will be passed to the web server at startup as environment variables. At a minimum, it should contain the following:

```
OPTOUT_API_KEY=test-optout-key
OPTOUT_API_SECRET=734UijWRaviZ28bulrlO5yGsEUB5oQrTFHyVICWkCXo=
OPTOUT_ENDPOINT_URL=http://localhost:8080/v2/token/logout
RECAPTCHA_SITE_KEY=
RECAPTCHA_SECRET=
```

You should set the values to match your local test environment. The provided `OPTOUT_` values are taken from the test values in `/src/main/resources/com.uid2.core/test/clients/clients.json` in the UID2 Operator repo. You will need the Operator and Optout services (in other repos) running for opt-out requests to work. If you use the `port_offset` variable to run Operator on a different port, make sure you use a matching port number in `ENDPOINT_URL`.

To get values for the `RECAPTCHA_` settings, you will need to create your own keys. Visit the [Google Recaptcha admin console](https://www.google.com/recaptcha/admin/) and create a reCAPTCHA v3 site with domains set to `localhost` and `127.0.0.1`.

## Running in developer mode

Run the Yarn task `euid` or `uid2` to launch the relevant site, and then visit [localhost:3000](http://localhost:3000/). There's no hot reload, but content should be served straight from the repo and so changes should be reflected as soon as you refresh your browser.

If port 3000 is in use and you need to use a different port, and a line to your `.env` file (where `nnnn` is the port you want to run on):
```
PORT=nnnn
```

## Confirming it works!

The actual deployment will use the two dockerfiles to build images for deployment. Before you request a merge, make sure it works in both! This is a production-like test - the dev experience won't be quite as good. From this folder:

```
docker build --pull --rm -f "Dockerfile_euid" -t euid-tcportal "."
docker run -dp 3000:3000 euid-tcportal
```

You should then be able to visit [localhost:3000](http://localhost:3000/) to see the container running. Replace `Dockerfile_euid` with `Dockerfile_uid` and `euid-tcportal` with `uid2-tcportal` (both commands) to run UID2 instead.

If port 3000 is in use and you need to run it on a different port, replace the *first* 3000 in the `docker run` command with the port you want to use (ensure the second one is still `3000`).

To shut down the Docker instance, run `docker stop containedID` where `containerID` is the ID returned by the `docker run` command when you launched it.
