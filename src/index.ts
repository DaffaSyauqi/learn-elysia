import { app } from "./app";
import { config } from "./config";

app.listen(config.port);

console.log(`Server running at http://localhost:${app.server?.port}`);
