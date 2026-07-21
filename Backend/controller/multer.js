import multer from "multer";
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../connection/cloudinaryConfig.js';

// Configure Cloudinary storage for multer
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'daily-hisab', // Folder in Cloudinary
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        transformation: [{ width: 1000, height: 1000, crop: 'limit' }], // Resize images
    },
});

const upload = multer({ storage: storage });
export default upload;
