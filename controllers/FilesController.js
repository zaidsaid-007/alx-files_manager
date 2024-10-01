import Queue from 'bull';
import fs from 'fs';
import mime from 'mime-types';
import { ObjectId } from 'mongodb';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import authUtils from '../utils/auth';
import dbClient from '../utils/db';

class FilesController {
  static async postUpload(req, res) {
    // Authenticate user, reject if no auth
    const checkAuth = await authUtils.checkAuth(req);
    if (checkAuth.status !== 200) return res.status(401).send({ error: 'Unauthorized' });

    // If authed, user is the payload from checkAuth()
    const userId = checkAuth.payload.id;

    // Get data from POST params
    const { name, type, data } = req.body;
    const parentId = req.body.parentId || 0;
    const isPublic = req.body.isPublic || false;

    // Get master folder path from env or default value
    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    // Check if folder exists and create it if it doesn't
    if (!fs.existsSync(folderPath)) {
      try {
        fs.mkdirSync(folderPath, { recursive: true });
      } catch (e) {
        console.error(e);
        return res.status(500).send({ error: 'Unable to locate folder' });
      }
    }

    if (!name) return res.status(400).send({ error: 'Missing name' });
    if (!type || !['folder', 'file', 'image'].includes(type)) return res.status(400).send({ error: 'Missing type' });
    if (!data && type !== 'folder') return res.status(400).send({ error: 'Missing data' });
    if (parentId) {
      // If the requested parent doesn't exist, return 400: Parent not found
      const parent = await dbClient.files.findOne({ _id: new ObjectId(parentId) });
      if (!parent) return res.status(400).send({ error: 'Parent not found' });

      // If the file with id === parentId is not a folder, return 400: Parent is not a folder
      if (parent.type !== 'folder') return res.status(400).send({ error: 'Parent is not a folder' });
    }

    // If type is a folder, just enter the metadata in the db
    if (type === 'folder') {
      const fileDBObj = {
        userId,
        name,
        type,
        parentId: parentId ? ObjectId(parentId) : 0,
      };

      dbClient.files.insertOne(fileDBObj);
      return res.status(201).send({
        id: fileDBObj._id,
        userId,
        name,
        type,
        isPublic,
        parentId: parentId ? ObjectId(parentId) : 0,
      });
    }

    // If type is a file, save it to disk and enter metadata in db
    const filename = uuidv4();
    const localPath = `${folderPath}/${filename}`;
    const decodedData = Buffer.from(data, 'base64');
    fs.writeFileSync(localPath, decodedData, { flag: 'w+' });

    const fileDBObj = {
      userId,
      name,
      type,
      isPublic,
      parentId: parentId ? ObjectId(parentId) : 0,
      localPath,
    };

    dbClient.files.insertOne(fileDBObj);

    // File is written, now create thumbnails if file is an image

    if (type === 'image') {
      const fileQueue = Queue('fileQueue');
      await fileQueue.add({ userId, fileId: fileDBObj._id });
    }

    // Return metadata to API

    return res.status(201).send({
      id: fileDBObj._id,
      userId,
      name,
      type,
      isPublic,
      parentId: parentId ? ObjectId(parentId) : 0,
    });
  }

  static async getShow(req, res) {
    // Authenticate user, reject if no auth
    const checkAuth = await authUtils.checkAuth(req);
    if (checkAuth.status !== 200) return res.status(401).send({ error: 'Unauthorized' });

    // If authed, user is the payload from checkAuth()
    const userId = checkAuth.payload.id;

    let { id } = req.params;
    try {
      id = ObjectId(id);
    } catch (e) {
      return res.status(404).send({ error: 'Not found' });
    }
    const requestedFile = await dbClient.files.findOne({
      _id: ObjectId(id),
      userId: ObjectId(userId),
    });

    if (!requestedFile) return res.status(404).send({ error: 'Not found' });

    const {
      _id,
      name,
      type,
      isPublic,
      parentId,
    } = requestedFile;

    return res.status(200).send({
      id: _id,
      userId,
      name,
      type,
      isPublic,
      parentId,
    });
  }

  static async getIndex(req, res) {
    // Authenticate user, reject if no auth
    const checkAuth = await authUtils.checkAuth(req);
    if (checkAuth.status !== 200) return res.status(401).send({ error: 'Unauthorized' });

    // If authed, user is the payload from checkAuth()
    const userId = checkAuth.payload.id;

    let { parentId, page } = req.query;
    // page number sanitizing
    page = page ? Number(page, 10) : 0;
    // parentId sanitizing
    if (!parentId || parentId === '0') {
      parentId = 0;
    } else {
      try {
        parentId = ObjectId(parentId);
      } catch (e) {
        parentId = 0;
      }
    }

    const query = [
      { $match: { parentId, userId: ObjectId(userId) } },
      { $skip: page * 20 },
      { $limit: 20 },
    ];

    const requestedFiles = await dbClient.files.aggregate(query).toArray();

    const sanitizedFiles = [];
    for (const elem of requestedFiles) {
      const file = {
        id: elem._id,
        name: elem.name,
        type: elem.type,
        isPublic: elem.isPublic,
        parentId: elem.parentId,
      };
      sanitizedFiles.push(file);
    }
    return res.status(200).send(sanitizedFiles);
  }

  static async putPublish(req, res) {
    // Authenticate user, reject if no auth
    const checkAuth = await authUtils.checkAuth(req);
    if (checkAuth.status !== 200) return res.status(401).send({ error: 'Unauthorized' });

    // If valid auth, user is the payload from checkAuth()
    const userId = checkAuth.payload.id;

    let { id } = req.params;
    try {
      id = ObjectId(id);
    } catch (e) {
      return res.status(404).send({ error: 'Not found' });
    }
    const requestedFile = await dbClient.files.findOne({
      _id: ObjectId(id),
      userId: ObjectId(userId),
    });

    if (!requestedFile) return res.status(404).send({ error: 'Not found' });

    const {
      _id,
      name,
      type,
      parentId,
    } = requestedFile;

    dbClient.files.updateOne(
      { _id: ObjectId(id) },
      { $set: { isPublic: true } },
    );

    return res.status(200).send({
      id: _id,
      userId,
      name,
      type,
      isPublic: true,
      parentId,
    });
  }

  static async putUnpublish(req, res) {
    // Authenticate user, reject if no auth
    const checkAuth = await authUtils.checkAuth(req);
    if (checkAuth.status !== 200) return res.status(401).send({ error: 'Unauthorized' });

    // If valid auth, user is the payload from checkAuth()
    const userId = checkAuth.payload.id;

    let { id } = req.params;
    try {
      id = ObjectId(id);
    } catch (e) {
      return res.status(404).send({ error: 'Not found' });
    }
    const requestedFile = await dbClient.files.findOne({
      _id: ObjectId(id),
      userId: ObjectId(userId),
    });

    if (!requestedFile) return res.status(404).send({ error: 'Not found' });

    const {
      _id,
      name,
      type,
      parentId,
    } = requestedFile;

    dbClient.files.updateOne(
      { _id: ObjectId(id) },
      { $set: { isPublic: false } },
    );

    return res.status(200).send({
      id: _id,
      userId,
      name,
      type,
      isPublic: false,
      parentId,
    });
  }

  static async getFile(req, res) {
    // Authenticate user, reject if no auth
    const checkAuth = await authUtils.checkAuth(req);
    const userId = checkAuth.status === 200 ? checkAuth.payload.id.toString() : undefined;

    let { id } = req.params;
    const { size } = req.query;
    try {
      id = ObjectId(id);
    } catch (e) {
      return res.status(404).send({ error: 'Not found' });
    }

    const requestedFile = await dbClient.files.findOne({ _id: ObjectId(id) });
    if (!requestedFile) return res.status(404).send({ error: 'Not found' });
    if (requestedFile.userId.toString() !== userId && !requestedFile.isPublic) return res.status(404).send({ error: 'Not found' });
    if (requestedFile.type === 'folder') return res.status(400).send({ error: 'A folder doesn\'t have content' });

    // Add support for image thumbnails

    if (size && requestedFile.type === 'image') {
      requestedFile.localPath = `${requestedFile.localPath}_${size}`;
      console.log(requestedFile.localPath);
    }

    if (!fs.existsSync(requestedFile.localPath)) return res.status(404).send({ error: 'Not found' });
    const mimeType = mime.lookup(path.extname(requestedFile.name));

    let fileContent;
    try {
      fileContent = fs.readFileSync(requestedFile.localPath, { flag: 'r' });
    } catch (e) {
      return res.status(404).send({ error: 'Not found' });
    }
    return res.status(200).setHeader('content-type', mimeType).send(fileContent);
  }
}

module.exports = FilesController;
