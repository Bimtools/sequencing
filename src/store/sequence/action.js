import * as actionType from './actionTypes'

export function CreateFolderRequest(payload){
    return{
        type:actionType.CREATE_FOLDER_REQUEST,
        payload:payload
    }
}
export function CreateFolderSuccess(payload){
    return{
        type:actionType.CREATE_FOLDER_SUCCESS,
        payload:payload
    }
}
export function CreateFolderFailure(payload){
    return{
        type:actionType.CREATE_FOLDER_FAILURE,
        payload:payload
    }
}

export function GetFolderRequest(payload){
    return{
        type:actionType.GET_FOLDER_REQUEST,
        payload:payload
    }
}
export function GetFolderSuccess(payload){
    return{
        type:actionType.GET_FOLDER_SUCCESS,
        payload:payload
    }
}
export function GetFolderFailure(payload){
    return{
        type:actionType.GET_FOLDER_FAILURE,
        payload:payload
    }
}

export function DeleteFolderRequest(payload){
    return{
        type:actionType.DELETE_FOLDER_REQUEST,
        payload:payload
    }
}
export function DeleteFolderSuccess(payload){
    return{
        type:actionType.DELETE_FOLDER_SUCCESS,
        payload:payload
    }
}
export function DeleteFolderFailure(payload){
    return{
        type:actionType.DELETE_FOLDER_FAILURE,
        payload:payload
    }
}

export function CreateCommentRequest(payload){
    return{
        type:actionType.CREATE_COMMENT_REQUEST,
        payload:payload
    }
}
export function CreateCommentSuccess(payload){
    return{
        type:actionType.CREATE_COMMENT_SUCCESS,
        payload:payload
    }
}
export function CreateCommentFailure(payload){
    return{
        type:actionType.CREATE_COMMENT_FAILURE,
        payload:payload
    }
}

export function GetCommentRequest(payload){
    return{
        type:actionType.GET_COMMENT_REQUEST,
        payload:payload
    }
}
export function GetCommentSuccess(payload){
    return{
        type:actionType.GET_COMMENT_SUCCESS,
        payload:payload
    }
}
export function GetCommentFailure(payload){
    return{
        type:actionType.GET_COMMENT_FAILURE,
        payload:payload
    }
}

export function DeleteCommentRequest(payload){
    return{
        type:actionType.DELETE_COMMENT_REQUEST,
        payload:payload
    }
}
export function DeleteCommentSuccess(payload){
    return{
        type:actionType.DELETE_COMMENT_SUCCESS,
        payload:payload
    }
}
export function DeleteCommentFailure(payload){
    return{
        type:actionType.DELETE_COMMENT_FAILURE,
        payload:payload
    }
}

export function UpdateCommentRequest(payload){
    return{
        type:actionType.UPDATE_COMMENT_REQUEST,
        payload:payload
    }
}
export function UpdateCommentSuccess(payload){
    return{
        type:actionType.UPDATE_COMMENT_SUCCESS,
        payload:payload
    }
}
export function UpdateCommentFailure(payload){
    return{
        type:actionType.UPDATE_COMMENT_FAILURE,
        payload:payload
    }
}

export function SetObjectsRequest(payload){
    return{
        type:actionType.SET_OBJECTS_REQUEST,
        payload:payload
    }
}
export function SetObjectsSuccess(payload){
    return{
        type:actionType.SET_OBJECTS_SUCCESS,
        payload:payload
    }
}
export function SetObjectsFailure(payload){
    return{
        type:actionType.SET_OBJECTS_FAILURE,
        payload:payload
    }
}