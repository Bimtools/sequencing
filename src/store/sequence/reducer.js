import * as type from "./actionTypes";

const initialState = {
  rootFolderId: null,
  rootCommentId: null,
  phaseFolderId: null,
  phaseCommentId: null,
  phases: [],
  sequences: [],
  sequencesToBeCopied: [],
  sequenceObjects: [],
  selectedObjects: [],
  selectedGroup: null,
  pending: false,
  error: null,
};

const reducers = (state = initialState, action) => {
  switch (action.type) {
    case type.CREATE_PLAN_REQUEST:
    case type.UPDATE_PLAN_REQUEST:
    case type.GET_PLAN_REQUEST:
    case type.DELETE_PLAN_REQUEST:
    case type.CREATE_SEQUENCE_REQUEST:
    case type.UPDATE_SEQUENCE_REQUEST:
    case type.GET_SEQUENCE_REQUEST:
    case type.GET_SOURCE_SEQUENCE_REQUEST:
    case type.DELETE_SEQUENCE_REQUEST:
    case type.UPDATE_COMMENT_REQUEST:
    case type.SET_OBJECTS_REQUEST:
    case type.SELECT_OBJECTS_REQUEST:
      return {
        ...state,
        pending: true,
        error: null,
      };

    case type.CREATE_PLAN_SUCCESS:
      return {
        ...state,
        pending: false,
        rootCommentId: action.payload.rootCommentId,
        phases: Array.isArray(action.payload.phases)
          ? [...action.payload.phases]
          : [],
      };

    case type.UPDATE_PLAN_SUCCESS:
      return {
        ...state,
        pending: false,
        phases: Array.isArray(action.payload.phases)
          ? [...action.payload.phases]
          : state.phases,
      };

    case type.GET_PLAN_SUCCESS:
      return {
        ...state,
        pending: false,
        rootCommentId: action.payload.rootCommentId,
        rootFolderId: action.payload.folderId,
        phases: Array.isArray(action.payload.phases)
          ? action.payload.phases
          : [],
      };

    case type.DELETE_PLAN_SUCCESS:
      return {
        ...state,
        pending: false,
        phases: Array.isArray(action.payload.phases)
          ? [...action.payload.phases]
          : [],
        sequences: [],
        sequenceObjects: [],
        selectedObjects: [],
        selectedGroup: null,
      };

    case type.CREATE_SEQUENCE_SUCCESS:
      return {
        ...state,
        pending: false,
        phaseCommentId: action.payload.phaseCommentId,
        sequences: Array.isArray(action.payload.sequences)
          ? [...action.payload.sequences]
          : [],
        sequenceObjects: Array.isArray(action.payload.sequenceObjects)
          ? [...action.payload.sequenceObjects]
          : [],
      };

    case type.UPDATE_SEQUENCE_SUCCESS:
      return {
        ...state,
        pending: false,
        sequences: Array.isArray(action.payload.sequences)
          ? [...action.payload.sequences]
          : state.sequences,
      };

    case type.GET_SEQUENCE_SUCCESS:
      return {
        ...state,
        pending: false,
        phaseFolderId: action.payload.phaseFolderId,
        phaseCommentId: action.payload.phaseCommentId,
        sequences: Array.isArray(action.payload.sequences)
          ? [...state.sequences, ...action.payload.sequences]
          : [...state.sequences],
        sequenceObjects: Array.isArray(action.payload.sequenceObjects)
          ? [...action.payload.sequenceObjects]
          : [],
        selectedObjects: [],
        selectedGroup: null,
      };

    case type.GET_SOURCE_SEQUENCE_SUCCESS:
      return {
        ...state,
        pending: false,
        sequencesToBeCopied: Array.isArray(action.payload.sequences)
          ? [...action.payload.sequences]
          : [],
      };

    case type.DELETE_SEQUENCE_SUCCESS:
      return {
        ...state,
        pending: false,
        sequences: Array.isArray(action.payload.sequences)
          ? [...action.payload.sequences]
          : [],
        sequenceObjects: Array.isArray(action.payload.sequenceObjects)
          ? [...action.payload.sequenceObjects]
          : [],
        selectedObjects: [],
        selectedGroup: null,
      };

    case type.UPDATE_COMMENT_SUCCESS:
      return {
        ...state,
        pending: false,
        rootCommentId: action.payload.rootCommentId ?? state.rootCommentId,
        phaseCommentId: action.payload.phaseCommentId ?? state.phaseCommentId,
        phases: Array.isArray(action.payload.phases)
          ? [...action.payload.phases]
          : state.phases,
        sequences: Array.isArray(action.payload.sequences)
          ? [...action.payload.sequences]
          : state.sequences,
        sequenceObjects: Array.isArray(action.payload.sequenceObjects)
          ? [...action.payload.sequenceObjects]
          : state.sequenceObjects,
      };

    case type.SET_OBJECTS_SUCCESS: {
      const remaining = state.sequenceObjects.filter(
        (x) => x && x.folderId !== action.payload.folderId,
      );

      return {
        ...state,
        pending: false,
        sequenceObjects: [...remaining, action.payload],
      };
    }

    case type.SELECT_OBJECTS_SUCCESS: {
      const objects = action.payload?.objects ?? [];
      const selectedGroup = action.payload?.folderId ?? null;

      return {
        ...state,
        pending: false,
        selectedObjects: objects,
        selectedGroup,
      };
    }

    case type.CREATE_PLAN_FAILURE:
    case type.UPDATE_PLAN_FAILURE:
    case type.GET_PLAN_FAILURE:
    case type.DELETE_PLAN_FAILURE:
    case type.CREATE_SEQUENCE_FAILURE:
    case type.UPDATE_SEQUENCE_FAILURE:
    case type.GET_SEQUENCE_FAILURE:
    case type.GET_SOURCE_SEQUENCE_FAILURE:
    case type.DELETE_SEQUENCE_FAILURE:
    case type.UPDATE_COMMENT_FAILURE:
    case type.SET_OBJECTS_FAILURE:
    case type.SELECT_OBJECTS_FAILURE:
      return {
        ...state,
        pending: false,
        error: action.payload || action.error,
      };

    default:
      return state;
  }
};

export default reducers;
