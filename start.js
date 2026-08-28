// Launcher — sets the working directory correctly before starting the server
// so that dotenv finds .env and all relative requires resolve properly.
process.chdir(__dirname);
require('./src/server.js');
