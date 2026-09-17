import express from 'express';
import multer from 'multer';
import cors from 'cors';

import { createServer } from 'node:http';
import { Server } from 'socket.io';

import multerS3 from 'multer-s3';
import {GetObjectCommand, S3Client} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
    endpoint: `${process.env.S3_IP}`,
    region: 'us-east-1',
    credentials: {
        accessKeyId: process.env.S3_ACCESS,
        secretAccessKey: process.env.S3_SECRET
    },
    forcePathStyle: true
});

const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.S3_BUCKET_NAME,
        key: function (req, file, cb) {
            cb(null, file.originalname);
        }
    }),
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'), false);
        }
    },
    limits: {
        fileSize: 1024 * 1024 * 50
    }
})

const app = express();
app.use(cors({
    origin: 'https://live-chato.orabis.fr',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'https://live-chato.orabis.fr',
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }
});

io.use((socket, next) => {
    const password = socket.handshake.auth.token

    if (password === process.env.GLOBAL_TOKEN) {
        return next();
    }
    return next(new Error('Acces Refusé'));
})

const checkAuth = (req, res, next) => {
    const clientPass = req.headers['authorization']

    if (clientPass !== process.env.GLOBAL_TOKEN) {
        return res.status(401).json({
            error : 'Mot de passe incorrect'
        })
    }
    next();
}

app.post('/videos-upload', checkAuth, function (req, res) {
    const uploadSingle = upload.single("video");

    uploadSingle(req, res, function (err) {
        const videoText = req.body.name
        if (videoText.length >= 31) {
            return res.status(400).json({
                error: 'Text trop long'
            });
        }
        if (err) {
            if (err.message === 'Invalid file type') {
                return res.status(415).json({
                    error: "Format non supporté. Seules les vidéos sont acceptées."
                });
            }
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({
                    error: "Le fichier est trop volumineux."
                });
            }
	    console.log(err)
            return res.status(500).json({ error: "Erreur lors de l'upload du fichier." });
        }
        if (!req.file) {
            return res.status(400).json({ error: "Aucun fichier reçu" });
        }
        res.status(201).json({ success: "Created", videoName: req.file.key });
    });
});

app.get('/videos/:id', checkAuth, async (req, res) => {
    try {
        const videoId = req.params.id;
        const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: videoId
        })
        const url = await getSignedUrl(s3, command, { expiresIn: 3600 })
        res.json({ url:url })
    } catch (error) {
        console.error("Erreur de la génération du lien : ", error);
        res.status(500).json({ error: "Impossible de récupérer la vidéo"})
    }
})
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

io.on('connection', (socket) => {
    socket.on('newChat', (msg) => {
        console.log("Vidéo Emis", msg)
        io.emit('sendChat', msg)
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`server running at http://localhost:${PORT}`);
});
