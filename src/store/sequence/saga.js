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
} from "./action";
import instance from "../../interceptors/axios";

function* getSequenceSaga(action) {
  try {
    //Check Sequence Folder
    const getFolderUrl = `/folders/by_path?path=${action.payload.projectName}&projectId=${action.payload.projectId}`;
    const response = yield call(instance.get, getFolderUrl);
    const folders = response.data.filter((x) => x.name === "Sequence");
    if (folders.length == 0) {
      const insertFolderUrl = `/folders`;
      const insertFolderResponse = yield call(instance.post, insertFolderUrl, {
        name: "Sequence",
        parentId: response.data[0].parentId,
      });
      yield put(
        GetSequenceSuccess({
          folderId: insertFolderResponse.data.id,
          folders: [],
        }),
      );
    } else {
      //Get comment in the sequence folder
      const getCommentUrl = `/comments?objectId=${folders[0].id}&objectType=FOLDER`;
      const commentResponse = yield call(instance.get, getCommentUrl);
      const sequences = JSON.parse(
        commentResponse.data.length > 0
          ? commentResponse.data[0].description
          : "[]",
      );

      const sequenceObjects = [];
      for (const sequence of sequences) {
        const getSequenceCommentUrl = `/comments?objectId=${sequence.id}&objectType=FOLDER`;
        const sequenceCommentResponse = yield call(
          instance.get,
          getSequenceCommentUrl,
        );
        const contents = sequenceCommentResponse.data.map((x) => {
          return {
            id: x.description.split("tuan")[0],
            content: x.description.split("tuan")[1],
          };
        });
        contents.sort((a, b) => parseInt(a.id) - parseInt(b.id));
        const content = contents.map((x) => x.content).join("");
        const objects = JSON.parse(content.length > 0 ? content : "[]");
        console.log("objects", objects);
        sequenceObjects.push({ folderId: sequence.id, objects: objects });
      }
      console.log("sequenceObjects", sequenceObjects);
      yield put(
        GetSequenceSuccess({
          commentId:
            commentResponse.data.length > 0 ? commentResponse.data[0].id : null,
          folderId: folders[0].id,
          sequences: sequences,
          sequenceObjects: sequenceObjects,
        }),
      );
    }
  } catch (error) {
    console.error("Error fetching folder:", error);
    yield put(GetSequenceFailure(error.message));
  }
}
function* createSequenceSaga(action) {
  const insertFolderUrl = `/folders`;
  console.log(action.payload);
  const insertFolderBody = {
    name: action.payload.name + "_" + action.payload.color,
    parentId: action.payload.rootFolderId,
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
    };
    const newSequences = [...action.payload.sequences, newSequence];
    console.log(newSequences);
    if (action.payload.rootCommentId) {
      //Update comment with new sequence list
      const updateCommentUrl = `/comments/${action.payload.rootCommentId}`;
      yield call(instance.patch, updateCommentUrl, {
        description: JSON.stringify(newSequences),
      });
      yield put(
        CreateSequenceSuccess({
          rootCommentId: action.payload.rootCommentId,
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
        objectId: action.payload.rootFolderId,
        objectType: "FOLDER",
        description: JSON.stringify(newSequences),
      };
      console.log(createCommentBody);
      const responseInsertComment = yield call(
        instance.post,
        createCommentUrl,
        createCommentBody,
      );
      yield put(
        CreateSequenceSuccess({
          rootCommentId: responseInsertComment.data.id,
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
function* updateCommentSaga(action) {
  try {
    //Update comment with new sequence list
    const updateCommentUrl = `/comments/${action.payload.commentId}`;
    yield call(instance.patch, updateCommentUrl, {
      description: JSON.stringify(action.payload.sequences),
    });
    yield put(
      UpdateCommentSuccess({
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
        (x) => x.id !== action.payload.folderId,
      );
      const newSequenceObjects = action.payload.sequenceObjects.filter(
        (x) => x.folderId !== action.payload.folderId,
      );

      //Update comment with new sequence list
      const updateCommentUrl = `/comments/${action.payload.rootCommentId}`;
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
    const folderId = action.payload.folderId
    console.log(folderId)
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
  yield takeEvery("DELETE_SEQUENCE_REQUEST", deleteSequenceSaga);
  yield takeEvery("UPDATE_COMMENT_REQUEST", updateCommentSaga);
  yield takeEvery("CREATE_SEQUENCE_REQUEST", createSequenceSaga);
  yield takeEvery("GET_SEQUENCE_REQUEST", getSequenceSaga);
  yield takeEvery("SET_OBJECTS_REQUEST", setObjectsSaga);
}
export default sequenceSaga;
