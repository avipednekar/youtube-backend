import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"

const generateAccessAndRefreshTokens = async (userId)=>{
    try {
        const user = await User.findById(userId)

        const accessToken= user.generateAccessToken();
        const refreshToken= user.generateRefreshToken();

        // console.log(accessToken)
        user.refreshToken=refreshToken
        await user.save({validateBeforeSave:false})

        return {accessToken,refreshToken}
    } catch (error) {
        console.log(error)
        throw new ApiError(500,"Something went wrong while generating access and refresh token",error)
    }
}

const registerUser = asyncHandler(async (req,res)=>{
    // get user details
    // validation
    // user already exists :email,username
    // check image : avatar
    // upload on cloudinary
    // create user object -- save in db
    // remove password and refersh token

    const {fullName, email, username, password}=req.body;

    // console.log("email:",email);

    if(fullName===""){
        throw new ApiError(400,"Fullname is required")
    }
    if(email===""){
        throw new ApiError(400,"Email is required")
    }
    if(username===""){
        throw new ApiError(400,"username is required")
    }
    if(password===""){
        throw new ApiError(400,"password is required")
    }
    //Advance code
    // if(
    //     [fullName,email,username,password].some((field)=> field?.trim() === "")
    // ){
    //     throw new ApiError(400, "all fields required")
    // }

    const existeduser=await User.findOne({
        $or:[{username},{email}]
    })

    if(existeduser){
        throw new ApiError(409,"Username or email already exists")
    }

    const avatarLocalPath=req.files?.avatar[0]?.path;
    // console.log(avatarLocalPath);
    
    // const coverImageLocalPath=req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
        coverImageLocalPath=req.files.coverImage[0].path
    }

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar is compalsory");
    }

    const avatar=await uploadOnCloudinary(avatarLocalPath);
    const coverImage=await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400,"Avatar is not uploading")
    }

    const user=await User.create({
        fullName,
        avatar:avatar.url,
        coverImage:coverImage?.url || "",
        email,
        username,
        password
    });

    const createdUser=await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registrating user")
    }

    return res.status(201).json(
        new ApiResponse(200,createdUser,"Registration successfully")
    )
})

const loginUser = asyncHandler(async (req,res)=>{
    // req body->data
    // find username or email
    // find user
    // password check
    // generate access and refresh token
    // send cookie

    const {email,username,password}=req.body;
    // console.log(email);
    

    if(!(email || username)){
        throw new ApiError(404,"username or email is required")
    }

    if(!password){
        throw new ApiError(401,"Password is required")
    }

    const user=await User.findOne({
        $or:[{username},{email}]
    })

    if(!user){
        throw new ApiError(404,"User does not exits")
    }

    const isPasswordvalid=await user.isPasswordCorrect(password)

    if(!isPasswordvalid){
        throw new ApiError(401,"Password is invalid or incorrect")
    }

    const {accessToken,refreshToken}= await generateAccessAndRefreshTokens(user._id)

    const loggedInuser= await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user:loggedInuser,refreshToken,accessToken
            },
            "User logged in succesfully"
        )
    )
})

const logoutUser=asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset:{
                refreshToken:1
            }
        },
        {
            new:true
        }
    )

    const options = {
        httpOnly:true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(
        new ApiResponse(200,{},"User logged out")
    )
})

const refreshAccessToken = asyncHandler(async (req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401,"unauthorized access")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id);
    
        if(!user){
            throw new ApiError(402,"Invalid refresh token")
        }
    
        if(incomingRefreshToken!==user?.refreshToken){
            throw new ApiError(401,"Refresh token is used or expired")
        }
    
        const options = {
            httpOnly:true,
            secure:true
        }
    
        const {accessToken,newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(
            new ApiResponse(
                200,
                {accessToken,refreshToken:newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401,error.message||"Invalid refresh token")
    }
})

const changeCurrentPassword = asyncHandler(async (req,res)=>{
    const {oldPassword,newPassword}=req.body

    const user= await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(401,"Invalid old password")
    }

    user.password=newPassword
    await user.save({validateBeforeSave:false})

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {},
            "Password changed successfully"
        )
    )
})

const getCurrentUser = asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(
        new ApiResponse(200,req.user,"User fetched successfully")
    )
})

const updateUserDetails = asyncHandler(async(req,res)=>{
    const {fullName,email} = req.body;

    if(!fullName || !email){
        throw new ApiError(401,"Full Name and email required")
    }

    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName,
                email
            }
        },
        {
            new:true
        }
    ).select("-password -refreshToken")

    if(!updatedUser){
        throw new ApiError(501,"Updated user cannot created")
    }

    return res
    .status(201)
    .json(
        new ApiResponse(200,updatedUser,"User details updated successfully")
    )
})

const updateAvatar = asyncHandler(async(req,res)=>{
    const avatarLocalPath = req.file?.path;
    // console.log(req.file);   

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar image is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if(!avatar.url){
        throw new ApiError(500,"Something went wrong while uploading file")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{avatar:avatar.url}
        },
        {new:true}
    ).select("-password")

    return res
    .status(201)
    .json(
        new ApiResponse(200,user,"Avatar updated successfully")
    )
})

const updateCoverImage = asyncHandler(async(req,res)=>{
    const coverImageLocalPath = req.file?.path;

    if(!coverImageLocalPath){
        throw new ApiError(400,"Cover image is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!coverImage.url){
        throw new ApiError(500,"Something went wrong while uploading file")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{coverImage:coverImage.url}
        },
        {new:true}
    ).select("-password")

    return res
    .status(201)
    .json(
        new ApiResponse(200,user,"Cover Image updated successfully")
    )
})

const getUserChannelProfile=asyncHandler(async (req,res)=>{
    const {username}=req.params

    if (!username?.trim()) {
        throw new ApiError(400,"User is missing")
    }

    const channel = await User.aggregate([
        {
            $match:{
                username:username.toLowerCase()
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"channel",
                as:"subscribers"
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"subscriber",
                as:"subscribedTo"
            }
        },
        {
            $addFields:{
                subscribersCount:{
                    $size:"$subscriber"
                },
                channelsSubscribedToCount:{
                    $size:"$subscribedTo"
                },
                isSubscribed:{
                    $cond:{
                        if:{ $in: [req.user?._id,"$subscribers.subscriber" ]},
                        then:true,
                        else:false
                    }
                }
            }
        },
        {
            $project:{
                fullName:1,
                username:1,
                subscribersCount:1,
                channelsSubscribedToCount:1,
                isSubscribed:1,
                avatar,
                coverImage
            }
        }
    ])

    if(!channel?.length()){
        throw new ApiError(400,"channel does not exists")
    }
    console.log(channel);
    
    return res
    .status(201)
    .json(
        new ApiResponse(200,channel[0],"Channel fetched successfully")
    )
})

const getWatchHistory = asyncHandler(async (req,res)=>{
    const user = await User.aggregate([
        {
            $match:{
                _id:new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup:{
                from:"videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullName:1,
                                        username:1,
                                        avatar:1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first:"$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched successfully"
        )
    )
})
 
export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateUserDetails,
    updateAvatar,
    updateCoverImage,
    getUserChannelProfile,
    getWatchHistory
}