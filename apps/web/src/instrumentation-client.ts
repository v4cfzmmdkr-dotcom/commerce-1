import { initBotId } from "botid/client/core"

// Server actions post to the page they are invoked from.
initBotId({
  protect: [{ path: "/checkout", method: "POST" }],
})
