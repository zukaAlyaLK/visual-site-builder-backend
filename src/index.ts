import http from 'http';
import dotenv from 'dotenv';

dotenv.config();

import app from './app';
import { initSocket } from './socket';

const PORT = process.env.PORT || 3001;

const server = http.createServer(app);

initSocket(server);

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
});
