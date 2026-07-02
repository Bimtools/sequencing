import axios from "axios";
import {
  all,
  call,
  put,
  takeLatest,
  takeEvery,
  fork,
} from "redux-saga/effects";
import {
  CreateSequenceSuccess,
  CreateSequenceFailure,
  DeleteSequenceFailure,
  DeleteSequenceSuccess,
  UpdateCommentSuccess,
  UpdateCommentFailure,
  SetObjectsSuccess,
  SetObjectsFailure,
  GetSequenceSuccess,
  GetSequenceFailure,
  GetSourceSequenceSuccess,
  GetSourceSequenceFailure,
  GetPlanSuccess,
  GetPlanFailure,
  CreatePlanSuccess,
  CreatePlanFailure,
  UpdatePlanSuccess,
  UpdatePlanFailure,
  DeletePlanSuccess,
  DeletePlanFailure,
} from "./action";
import instance from "../../interceptors/axios";
function* getPlansSaga(action) {
  try {
    //Check Sequence Folder
    const getFolderUrl = `/folders/by_path?path=${action.payload.projectName}&projectId=${action.payload.projectId}`;
    const response = yield call(instance.get, getFolderUrl);
    const folders = response.data.filter((x) => x.name === "Sequence");
    if (folders.length === 0) {
      const insertFolderUrl = `/folders`;
      const insertFolderResponse = yield call(instance.post, insertFolderUrl, {
        name: "Sequence",
        parentId: response.data[0].parentId,
      });
      yield put(
        GetPlanSuccess({
          folderId: insertFolderResponse.data.id,
          phases: [],
        }),
      );
    } else {
      //Get comment in the sequence folder
      const getCommentUrl = `/comments?objectId=${folders[0].id}&objectType=FOLDER`;
      const commentResponse = yield call(instance.get, getCommentUrl);
      const phases = JSON.parse(
        commentResponse.data.length > 0
          ? commentResponse.data[0].description
          : "[]",
      );
      console.log(commentResponse.data);
      yield put(
        GetPlanSuccess({
          rootCommentId:
            commentResponse.data.length > 0 ? commentResponse.data[0].id : null,
          folderId: folders[0].id,
          phases: phases,
        }),
      );
    }
  } catch (error) {
    console.error("Error fetching folder:", error);
    yield put(GetPlanFailure(error.message));
  }
}
function* createPlanSaga(action) {
  const insertFolderUrl = `/folders`;
  console.log(action.payload);
  const insertFolderBody = {
    name: action.payload.name,
    parentId: action.payload.rootFolderId,
  };
  const insertFolderResponse = yield call(
    instance.post,
    insertFolderUrl,
    insertFolderBody,
  );
  try {
    const newPhase = {
      id: insertFolderResponse.data.id,
      name: action.payload.name,
    };
    const newPhases = [...action.payload.phases, newPhase];
    console.log(newPhases);
    if (action.payload.rootCommentId) {
      //Update comment with new phase list
      const updateCommentUrl = `/comments/${action.payload.rootCommentId}`;
      yield call(instance.patch, updateCommentUrl, {
        description: JSON.stringify(newPhases),
      });
      yield put(
        CreatePlanSuccess({
          rootCommentId: action.payload.rootCommentId,
          phases: [...action.payload.phases, newPhase],
        }),
      );
    } else {
      //Create comment with phase list
      const createCommentUrl = `/comments`;
      const createCommentBody = {
        objectId: action.payload.rootFolderId,
        objectType: "FOLDER",
        description: JSON.stringify(newPhases),
      };
      console.log(createCommentBody);
      const responseInsertComment = yield call(
        instance.post,
        createCommentUrl,
        createCommentBody,
      );
      yield put(
        CreatePlanSuccess({
          rootCommentId: responseInsertComment.data.id,
          phases: [...action.payload.phases, newPhase],
        }),
      );
    }
  } catch (error) {
    console.error("Error creating folder:", error);
    yield put(CreatePlanFailure(error.message));
  }
}
function* updatePlanSaga(action) {
  try {
    //Update comment with new sequence list
    const updateCommentUrl = `/comments/${action.payload.commentId}`;
    yield call(instance.patch, updateCommentUrl, {
      description: JSON.stringify(action.payload.phases),
    });
    yield put(
      UpdatePlanSuccess({
        phases: [...action.payload.phases],
      }),
    );
  } catch (error) {
    console.error("Error updating comment:", error);
    yield put(UpdatePlanFailure(error.message));
  }
}
function* deletePlanSaga(action) {
  try {
    //Delete folder
    const deleteFolderUrl = `/folders/${action.payload.folderId}`;
    var deleteStatus = false;
    try {
      const deleteFolderResponse = yield call(instance.delete, deleteFolderUrl);
      console.log("deleteFolderResponse", deleteFolderResponse.status);
      deleteStatus = deleteFolderResponse.status === 204;
    } catch (error) {
      deleteStatus = error.message.includes("404");
    }
    if (deleteStatus) {
      const newPhases = action.payload.phases.filter(
        (x) => x.id !== action.payload.folderId,
      );

      //Update comment with new sequence list
      const updateCommentUrl = `/comments/${action.payload.rootCommentId}`;
      yield call(instance.patch, updateCommentUrl, {
        description: JSON.stringify(newPhases),
      });
      yield put(
        DeletePlanSuccess({
          phases: [...newPhases],
        }),
      );
    } else {
      yield put(DeletePlanFailure("Failed to delete plan"));
    }
  } catch (error) {
    console.error("Error updating comment:", error);
    yield put(DeletePlanFailure(error.message));
  }
}
function* getSequenceSaga(action) {
  try {
    //Get comment in the sequence folder
    const getCommentUrl = `/comments?objectId=${action.payload.folderId}&objectType=FOLDER`;
    const commentResponse = yield call(instance.get, getCommentUrl);

    const sequences = JSON.parse(
      commentResponse.data.length > 0
        ? commentResponse.data[0].description
        : "[]",
    );

    console.log(commentResponse.data);

    const sequenceObjects = [];
    for (const sequence of sequences) {
      const getSequenceCommentUrl = `/comments?objectId=${sequence.id}&objectType=FOLDER`;
      const sequenceCommentResponse = yield call(
        instance.get,
        getSequenceCommentUrl,
      );
      console.log("sequenceCommentResponse", sequenceCommentResponse);
      const contents = sequenceCommentResponse.data.map((x) => {
        return {
          id: x.description.split("tuan")[0],
          content: x.description.split("tuan")[1],
        };
      });
      contents.sort((a, b) => parseInt(a.id) - parseInt(b.id));
      const content = contents.map((x) => x.content).join("");
      const objects = JSON.parse(content.length > 0 ? content : null);
      sequenceObjects.push(objects);
    }
    console.log("sequenceObjects", sequenceObjects);
    yield put(
      GetSequenceSuccess({
        phaseCommentId:
          commentResponse.data.length > 0 ? commentResponse.data[0].id : null,
        phaseFolderId: action.payload.folderId,
        sequences: sequences,
        sequenceObjects: sequenceObjects,
      }),
    );
  } catch (error) {
    console.error("Error fetching folder:", error);
    yield put(GetSequenceFailure(error.message));
  }
}
function* getSourceSequenceSaga(action) {
  try {
    //Get comment in the sequence folder
    const getCommentUrl = `/comments?objectId=${action.payload.folderId}&objectType=FOLDER`;
    const commentResponse = yield call(instance.get, getCommentUrl);

    const sequences = JSON.parse(
      commentResponse.data.length > 0
        ? commentResponse.data[0].description
        : "[]",
    );

    yield put(
      GetSourceSequenceSuccess({
        sequences: sequences,
      }),
    );
  } catch (error) {
    console.error("Error fetching folder:", error);
    yield put(GetSourceSequenceFailure(error.message));
  }
}
function* createSequenceSaga(action) {
  const insertFolderUrl = `/folders`;
  console.log(action.payload);
  const insertFolderBody = {
    name: action.payload.name,
    parentId: action.payload.phaseFolderId,
  };
  const insertFolderResponse = yield call(
    instance.post,
    insertFolderUrl,
    insertFolderBody,
  );
  try {
    const newSequence = {
      id: insertFolderResponse.data.id,
      name: action.payload.name,
      color: action.payload.color,
      check: action.payload.check
    };
    const newSequences = [...action.payload.sequences, newSequence];
    console.log(newSequences);
    if (action.payload.phaseCommentId) {
      //Update comment with new sequence list
      const updateCommentUrl = `/comments/${action.payload.phaseCommentId}`;
      yield call(instance.patch, updateCommentUrl, {
        description: JSON.stringify(newSequences),
      });
      yield put(
        CreateSequenceSuccess({
          phaseCommentId: action.payload.phaseCommentId,
          sequences: [...action.payload.sequences, newSequence],
          sequenceObjects: [
            ...action.payload.sequenceObjects,
            {
              folderId: newSequence.id,
              objectIds: [],
            },
          ],
        }),
      );
    } else {
      //Create comment with sequence list
      const createCommentUrl = `/comments`;
      const createCommentBody = {
        objectId: action.payload.phaseFolderId,
        objectType: "FOLDER",
        description: JSON.stringify(newSequences),
      };
      const responseInsertComment = yield call(
        instance.post,
        createCommentUrl,
        createCommentBody,
      );
      yield put(
        CreateSequenceSuccess({
          phaseCommentId: responseInsertComment.data.id,
          sequences: [...action.payload.sequences, newSequence],
          sequenceObjects: [
            ...action.payload.sequenceObjects,
            {
              folderId: newSequence.id,
              objectIds: [],
            },
          ],
        }),
      );
    }
  } catch (error) {
    console.error("Error creating folder:", error);
    yield put(CreateSequenceFailure(error.message));
  }
}
function* copySequenceSaga(action) {
  try {
    const newSequences = [];

    for (const sequence of action.payload.sequencesToBeCopied) {
      const insertFolderUrl = "/folders";
      const insertFolderBody = {
        name: sequence.name,
        parentId: action.payload.phaseFolderId,
      };

      const insertFolderResponse = yield call(
        instance.post,
        insertFolderUrl,
        insertFolderBody,
      );

      newSequences.push({
        id: insertFolderResponse.data.id,
        name: sequence.name,
        color: sequence.color,
      });
    }
    const updatedSequences = [...action.payload.sequences, ...newSequences];
    if (action.payload.phaseCommentId) {
      const updateCommentUrl = `/comments/${action.payload.commentId}`;
      yield call(instance.patch, updateCommentUrl, {
        description: JSON.stringify(updatedSequences),
      });
      yield put(UpdateCommentSuccess({ folders: updatedSequences, phaseCommentId: action.payload.phaseCommentId }));
    } else {
      //Create comment with sequence list
      const createCommentUrl = `/comments`;
      const createCommentBody = {
        objectId: action.payload.phaseFolderId,
        objectType: "FOLDER",
        description: JSON.stringify(updatedSequences),
      };
      const responseInsertComment = yield call(
        instance.post,
        createCommentUrl,
        createCommentBody,
      );

      yield put(UpdateCommentSuccess({ folders: updatedSequences, phaseCommentId: responseInsertComment.data.id }));
    }
  } catch (error) {
    console.error("Error updating comment:", error);
    const message = error?.message ?? "Something went wrong";
    yield put(UpdateCommentFailure(message));
  }
}
function* updateCommentSaga(action) {
  try {
    //Update comment with new sequence list
    const updateCommentUrl = `/comments/${action.payload.commentId}`;
    yield call(instance.patch, updateCommentUrl, {
      description: JSON.stringify(action.payload.sequences),
    });
    yield put(
      UpdateCommentSuccess({
        phaseCommentId: action.payload.commentId,
        folders: [...action.payload.sequences],
      }),
    );
  } catch (error) {
    console.error("Error updating comment:", error);
    yield put(UpdateCommentFailure(error.message));
  }
}
function* deleteSequenceSaga(action) {
  try {
    //Delete folder
    const deleteFolderUrl = `/folders/${action.payload.folderId}`;
    var deleteStatus = false;
    try {
      const deleteFolderResponse = yield call(instance.delete, deleteFolderUrl);
      console.log("deleteFolderResponse", deleteFolderResponse.status);
      deleteStatus = deleteFolderResponse.status === 204;
    } catch (error) {
      deleteStatus = error.message.includes("404");
    }
    if (deleteStatus) {
      const newSequences = action.payload.sequences.filter(
        (x) =>x && x.id !== action.payload.folderId,
      );
      const newSequenceObjects = action.payload.sequenceObjects.filter(
        (x) => x && x.folderId !== action.payload.folderId,
      );

      //Update comment with new sequence list
      const updateCommentUrl = `/comments/${action.payload.phaseCommentId}`;
      yield call(instance.patch, updateCommentUrl, {
        description: JSON.stringify(newSequences),
      });
      yield put(
        DeleteSequenceSuccess({
          sequences: [...newSequences],
          sequenceObjects: [...newSequenceObjects],
        }),
      );
    } else {
      yield put(DeleteSequenceFailure("Failed to delete sequence"));
    }
  } catch (error) {
    console.error("Error updating comment:", error);
    yield put(DeleteSequenceFailure(error.message));
  }
}
function* setObjectsSaga(action) {
  try {
    console.log("Set objects saga", action.payload);
    const folderId = action.payload.folderId;
    console.log(folderId);
    //Get all comments
    const getCommentUrl = `/comments?objectId=${folderId}&objectType=FOLDER`;
    const commentResponse = yield call(instance.get, getCommentUrl);

    for (const comment of commentResponse.data) {
      const deleteCommentUrl = `/comments/${comment.id}`;
      console.log("Deleting comment with id", comment.id);
      yield call(instance.delete, deleteCommentUrl);
    }

    //Create comment with sequence list
    const stringContent = JSON.stringify(action.payload);
    var startIndex = 0;
    var step = 800;
    var chunkIndex = 0;
    const createCommentUrl = `/comments`;
    while (startIndex < stringContent.length) {
      const chunk = stringContent.substring(startIndex, startIndex + step);
      startIndex += step;
      chunkIndex++;
      const createCommentBody = {
        objectId: folderId,
        objectType: "FOLDER",
        description: chunkIndex + "tuan" + chunk,
      };
      const responseInsertComment = yield call(
        instance.post,
        createCommentUrl,
        createCommentBody,
      );
    }
    yield put(SetObjectsSuccess(action.payload));
  } catch (error) {
    console.error("Error creating folder:", error);
    yield put(SetObjectsFailure(error.message));
  }
}

function* sequenceSaga() {
  yield takeEvery("GET_PLAN_REQUEST", getPlansSaga);
  yield takeEvery("CREATE_PLAN_REQUEST", createPlanSaga);
  yield takeEvery("UPDATE_PLAN_REQUEST", updatePlanSaga);
  yield takeEvery("DELETE_PLAN_REQUEST", deletePlanSaga);
  yield takeEvery("DELETE_SEQUENCE_REQUEST", deleteSequenceSaga);
  yield takeEvery("UPDATE_COMMENT_REQUEST", updateCommentSaga);
  yield takeEvery("CREATE_SEQUENCE_REQUEST", createSequenceSaga);
  yield takeEvery("GET_SEQUENCE_REQUEST", getSequenceSaga);
  yield takeEvery("GET_SOURCE_SEQUENCE_REQUEST", getSourceSequenceSaga);
  yield takeEvery("COPY_SEQUENCE_REQUEST", copySequenceSaga);
  yield takeEvery("SET_OBJECTS_REQUEST", setObjectsSaga);
}
export default sequenceSaga;
