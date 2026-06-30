const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true, players: Object.keys(players).length });
});

const colors = [
  0xda2525,
  0x2563eb,
  0x22c55e,
  0xeab308,
  0xa855f7,
  0xec4899,
  0xf97316,
  0x14b8a6
];

const spawnPoints = [
  { x: 0, y: 0, z: 5 },
  { x: 12, y: 0, z: 20 },
  { x: -18, y: 0, z: 18 },
  { x: -24, y: 0, z: -12 },
  { x: 0, y: 0, z: -12 },
  { x: 20, y: 0, z: -20 },
  { x: -20, y: 0, z: 2 },
  { x: 15, y: 0, z: -5 }
];

const players = {};

function randomName(socketId) {
  return `Jugador-${socketId.slice(0, 4)}`;
}

io.on("connection", (socket) => {
  const index = Object.keys(players).length;
  const spawn = spawnPoints[index % spawnPoints.length];

  players[socket.id] = {
    id: socket.id,
    name: randomName(socket.id),
    color: colors[index % colors.length],
    position: spawn,
    rotationY: 0,
    role: "crewmate",
    alive: true
  };

  socket.emit("currentPlayers", players);
  socket.emit("yourPlayerId", socket.id);
  socket.broadcast.emit("playerJoined", players[socket.id]);

  socket.on("setPlayerInfo", ({ name, role }) => {
    if (!players[socket.id]) return;

    players[socket.id].name = String(name || players[socket.id].name).slice(0, 20);
    players[socket.id].role = role === "impostor" ? "impostor" : "crewmate";

    io.emit("playerUpdated", players[socket.id]);
  });

  socket.on("playerMove", ({ position, rotationY }) => {
    if (!players[socket.id]) return;

    players[socket.id].position = {
      x: Number(position?.x) || 0,
      y: Number(position?.y) || 0,
      z: Number(position?.z) || 0
    };
    players[socket.id].rotationY = Number(rotationY) || 0;

    socket.broadcast.emit("playerMoved", players[socket.id]);
  });

  socket.on("playerKilled", ({ targetId }) => {
    if (!players[socket.id] || !players[targetId]) return;
    if (players[socket.id].role !== "impostor") return;

    players[targetId].alive = false;
    io.emit("playerUpdated", players[targetId]);
  });

  socket.on("taskCompleted", ({ taskId }) => {
    socket.broadcast.emit("remoteTaskCompleted", {
      playerId: socket.id,
      taskId
    });
  });

  socket.on("report", () => {
    io.emit("meetingReported", {
      playerId: socket.id,
      name: players[socket.id]?.name || "Jugador"
    });
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("playerLeft", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Servidor listo en puerto ${PORT}`);
});
