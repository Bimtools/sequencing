import * as actionType from './actionTypes'

export function CreateSequenceRequest(payload){
    return{
        type:actionType.CREATE_SEQUENCE_REQUEST,
        payload:payload
    }
}
export function CreateSequenceSuccess(payload){
    return{
        type:actionType.CREATE_SEQUENCE_SUCCESS,
        payload:payload
    }
}
export function CreateSequenceFailure(payload){
    return{
        type:actionType.CREATE_SEQUENCE_FAILURE,
        payload:payload
    }
}

export function GetSequenceRequest(payload){
    return{
        type:actionType.GET_SEQUENCE_REQUEST,
        payload:payload
    }
}
export function GetSequenceSuccess(payload){
    return{
        type:actionType.GET_SEQUENCE_SUCCESS,
        payload:payload
    }
}
export function GetSequenceFailure(payload){
    return{
        type:actionType.GET_SEQUENCE_FAILURE,
        payload:payload
    }
}

export function DeleteSequenceRequest(payload){
    return{
        type:actionType.DELETE_SEQUENCE_REQUEST,
        payload:payload
    }
}
export function DeleteSequenceSuccess(payload){
    return{
        type:actionType.DELETE_SEQUENCE_SUCCESS,
        payload:payload
    }
}
export function DeleteSequenceFailure(payload){
    return{
        type:actionType.DELETE_SEQUENCE_FAILURE,
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

export function SelectObjectsRequest(payload){
    return{
        type:actionType.SELECT_OBJECTS_REQUEST,
        payload:payload
    }
}
export function SelectObjectsSuccess(payload){
    return{
        type:actionType.SELECT_OBJECTS_SUCCESS,
        payload:payload
    }
}
export function SelectObjectsFailure(payload){
    return{
        type:actionType.SELECT_OBJECTS_FAILURE,
        payload:payload
    }
}