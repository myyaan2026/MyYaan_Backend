import app from "./index.js";

const port = process.env.PORT || 3001;

const server = app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
        console.error(`Port ${port} is already in use by another process.`);
        console.error(`To fix, either stop the process using port ${port}:`);
        console.error(`  lsof -ti :${port} | xargs kill -9`);
        console.error(`or set a different PORT in .env (e.g. PORT=3002).`);
    } else {
        console.error("Server error:", error);
    }
    process.exit(1);
});