import express from 'express';
import multer from 'multer';
import cors from 'cors';

import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import {dirname, join} from 'node:path';
import { Server } from 'socket.io';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'videos/');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
})
const upload = multer({ storage: storage })

const app = express();
const __dirname = dirname(fileURLToPath(import.meta.url));

app.use(cors({ origin: '*' }));
app.use('/videos', express.static(join(__dirname, 'videos')));

const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    }
});

app.post('/videos-upload', upload.single("video"), function (req, res) {
    if (!req.file) {
        return res.status(400).json({ error: "Aucun fichier reçu" });
    }
    console.log("Fichier sauvegardé :", req.file.filename);
    res.status(201).json({ success: "Created", videoName: req.file.filename });
});

io.on('connection', (socket) => {
    socket.on('newChat', (msg) => {
        console.log("video envoyé.. lecture", msg)
        io.emit('sendChat', msg)
    });
});

server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
});