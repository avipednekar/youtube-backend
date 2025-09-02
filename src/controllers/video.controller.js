import { Video } from "../models/video.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";

const uploadVideo = asyncHandler(async (req,res)=>{
    const {title,description} = req.body;

    // console.log(req.file);
    
    const localVideoPath = req.file?.path;
    
    const owner = req.user._id

    if(!title || !description){
        throw new ApiError(401,"All fields are required")
    }

    if(!localVideoPath){
        throw new ApiError(400,"Video is required")
    }

    const videoFile = await uploadOnCloudinary(localVideoPath)
    // console.log(videoFile);
    
    const video = await Video.create({
        videoFile:videoFile.url,
        title,
        description,
        duration:videoFile.duration,
        owner
    })


    if(!video){
        throw new ApiError(500,"Something went wrong while creating video")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,video,"Video uploaded successfully")
    )
})

const getAllVideos  = asyncHandler(async (req,res)=>{
    const {_id} = req.body;
    const video = await Video.findById(_id);

    
})

export {
    uploadVideo,
    getAllVideos
}