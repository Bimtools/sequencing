import logo from "./logo.svg";
import "./App.css";
import * as WorkspaceAPI from "trimble-connect-workspace-api";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  MenuOutlined,
  DeleteFilled,
  PlusOutlined,
  MinusOutlined,
  PlayCircleOutlined,
  PlayCircleFilled,
} from "@ant-design/icons";

import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Layout,
  Typography,
  List,
  Card,
  Input,
  Button,
  Popconfirm,
  Collapse,
} from "antd";
import {
  GetSequenceRequest,
  CreateSequenceRequest,
  UpdateCommentRequest,
  DeleteFolderRequest,
  SetObjectsRequest,
  DeleteSequenceRequest,
} from "./store/sequence/action";
import { retry } from "redux-saga/effects";
const { Header, Content } = Layout;
const { Title, Text } = Typography;
const math = require("mathjs");

function SortableItem({ item, children, sequenceObjects }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const objects = sequenceObjects.filter(x=>x.folderId === item.id)
  // console.log(sequenceObjects)
  return (
    <div>
      <List.Item ref={setNodeRef} style={style} {...attributes}>
        <div
          style={{
            display: "flex",
          }}
        >
          <MenuOutlined
            {...listeners}
            style={{ cursor: "grab", marginRight: 12 }}
          />
          <strong>{item.name}</strong>
        </div>
        {children}
      </List.Item>
      <DndContext onDragEnd={()=>{}}>
            <SortableContext
              items={objects.map((x) =>`${x.modelId}${x.id}`)}
              strategy={verticalListSortingStrategy}
            >
              <List
                dataSource={objects}
                renderItem={(item) => (
                  <SortableSubItem
                    key={item.id}
                    item={item}
                  >
                  </SortableSubItem>
                )}
              />
            </SortableContext>
          </DndContext>
    </div>
  );
}
function SortableSubItem({ item, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const onDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const newArray = (prev) => {
        const oldIndex = prev.findIndex((x) => x.id === active.id);
        const newIndex = prev.findIndex((x) => x.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      };
    }
  };
  // console.log(item)
  return (
    <div>
      <List.Item ref={setNodeRef} style={style} {...attributes}>
        <div
          style={{
            display: "flex",
          }}
        >
          <MenuOutlined
            {...listeners}
            style={{ cursor: "grab", marginRight: 12 }}
          />
          <strong>{item.id}</strong>
        </div>
        {children}
      </List.Item>
    </div>
  );
}

function App() {
  const dispatch = useDispatch();
  const sequenceState = useSelector((state) => state.sequence);
  const sequences = useSelector((state) => state.sequence.sequences);
  const sequenceObjects = useSelector(
    (state) => state.sequence.sequenceObjects,
  );
  const rootFolderId = useSelector((state) => state.sequence.rootFolderId);
  const rootCommentId = useSelector((state) => state.sequence.rootCommentId);
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [step, setStep] = useState("");
  const [timeStep, setTimeStep] = useState(500);

  const onDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const newArray = (prev) => {
        const oldIndex = prev.findIndex((x) => x.id === active.id);
        const newIndex = prev.findIndex((x) => x.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      };
      const newSequences = newArray(sequences);
      dispatch(
        UpdateCommentRequest({
          commentId: rootCommentId,
          sequences: newSequences,
        }),
      );
    }
  };

  useEffect(() => {
    async function fetchStatus() {
      const tcapi = await WorkspaceAPI.connect(window.parent);
      const token = await tcapi.extension.requestPermission("accesstoken");
      window.localStorage.setItem("trimbleToken", token);
      const project = await tcapi.project.getProject();
      setProjectId(project.id);
      setProjectName(project.name);
      dispatch(
        GetSequenceRequest({
          projectId: project.id,
          projectName: project.name,
        }),
      );
    }
    fetchStatus();
  }, []);
  return (
    <Layout style={{ height: "100vh" }}>
      <Header style={{ background: "#fff", height: "auto" }}>
        <Title level={4} style={{ margin: 0, alignContent: "center" }}>
          Sequencing
        </Title>
      </Header>
      <Content>
        <Card>
          <div style={{ display: "flex", maxWidth: "350px", gap: 5 }}>
            <Input
              style={{ flex: 1 }}
              placeholder="Time Step"
              value={timeStep}
              onChange={(e) => setTimeStep(Number(e.target.value))}
            />
            <Button
              type="primary"
              style={{ width: 100 }}
              onClick={async () => {
                const tcapi = await WorkspaceAPI.connect(window.parent);
                const delay = (ms) => new Promise((res) => setTimeout(res, ms));
                var accumulatedObjects = [];
                for (const sequence of sequences) {
                  const sequenceObjectsTobeShown = sequenceObjects.filter(
                    (x) => x.folderId === sequence.id,
                  );
                  try {
                    const objects =
                      sequenceObjectsTobeShown?.[0]?.objects?.objects ?? [];
                    if (objects.length > 0) {
                      for (const object of objects) {
                        const index = accumulatedObjects.findIndex(
                          (x) => x.modelId === object.modelId,
                        );
                        if (index >= 0) {
                          accumulatedObjects[index].entityIds.push(object.id);
                        } else {
                          accumulatedObjects.push({
                            modelId: object.modelId,
                            entityIds: [object.id],
                          });
                        }
                        await tcapi.viewer.isolateEntities(accumulatedObjects);
                        await tcapi.viewer.setObjectState(
                          {
                            modelObjectIds: [
                              {
                                modelId: object.modelId,
                                objectRuntimeIds: [object.id],
                              },
                            ],
                          },
                          {
                            color: {
                              r: 252,
                              g: 0,
                              b: 0,
                            },
                            visible: true,
                          },
                        );
                        await delay(timeStep);
                      }
                    }
                  } catch (error) {
                    console.error(
                      "Error processing sequence",
                      sequence.id,
                      error,
                    );
                  }
                }
              }}
            >
              Simulation
            </Button>
          </div>
          <div
            style={{ display: "flex", maxWidth: "350px", marginTop: 2, gap: 5 }}
          >
            <Input
              style={{ flex: 1 }}
              placeholder="Group Name"
              value={step}
              onChange={(e) => setStep(e.target.value)}
            />
            <Button
              type="primary"
              style={{ width: 100 }}
              onClick={() => {
                dispatch(
                  CreateSequenceRequest({
                    name: step,
                    color: "#fff",
                    rootFolderId: rootFolderId,
                    rootCommentId: rootCommentId,
                    sequences: sequences,
                    sequenceObjects: sequenceObjects,
                  }),
                );
              }}
            >
              Create
            </Button>
          </div>

          <DndContext onDragEnd={onDragEnd}>
            <SortableContext
              items={sequences.map((x) => x.id)}
              strategy={verticalListSortingStrategy}
            >
              <List
                loading={sequenceState.pending}
                dataSource={sequences}
                renderItem={(item) => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    sequenceObjects={sequenceObjects}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Button
                        type="text"
                        icon={<PlusOutlined />}
                        onClick={async () => {
                          const tcapi = await WorkspaceAPI.connect(
                            window.parent,
                          );
                          const selections = await tcapi.viewer.getSelection();
                          console.log(selections);
                          tcapi.viewer.activateTool("pointMarkup");
                          // handler stored so it can be removed later
                          const onMessage = async (event) => {
                            if (event.data.event === "viewer.onMarkupChanged") {
                              console.log(event.data.data.data.markup.start);
                              const start = event.data.data.data.markup.start;
                              const refPoint = [
                                Number(start.positionX),
                                Number(start.positionY),
                                Number(start.positionZ),
                              ];
                              var sequenceObjects = [];
                              selections.forEach(async (selection) => {
                                const objBoxes =
                                  await tcapi.viewer.getObjectBoundingBoxes(
                                    selection.modelId,
                                    selection.objectRuntimeIds,
                                  );

                                objBoxes.forEach((box) => {
                                  const center = math.divide(
                                    math.add(
                                      [
                                        1000 * Number(box.boundingBox.min.x),
                                        1000 * Number(box.boundingBox.min.y),
                                        1000 * Number(box.boundingBox.min.z),
                                      ],
                                      [
                                        1000 * Number(box.boundingBox.max.x),
                                        1000 * Number(box.boundingBox.max.y),
                                        1000 * Number(box.boundingBox.max.z),
                                      ],
                                    ),
                                    2,
                                  );
                                  const distance = math.distance(
                                    refPoint,
                                    center,
                                  );
                                  sequenceObjects.push({
                                    modelId: selection.modelId,
                                    id: box.id,
                                    distance: distance,
                                  });
                                  sequenceObjects.sort((a, b) => {
                                    return (
                                      Number(a.distance) - Number(b.distance)
                                    );
                                  });
                                });
                              });

                              const newSequenceObjects = {
                                folderId: item.id,
                                objects: sequenceObjects,
                              };
                              console.log(newSequenceObjects);
                              dispatch(SetObjectsRequest(newSequenceObjects));
                              window.removeEventListener("message", onMessage);
                            }
                          };

                          window.addEventListener("message", onMessage);
                        }}
                      />
                      <Button
                        type="text"
                        icon={<PlayCircleOutlined />}
                        onClick={async () => {
                          const tcapi = await WorkspaceAPI.connect(
                            window.parent,
                          );
                          const delay = (ms) =>
                            new Promise((res) => setTimeout(res, ms));
                          var accumulatedObjects = [];
                          const sequenceObjectsTobeShown =
                            sequenceObjects.filter(
                              (x) => x.folderId === item.id,
                            );
                          try {
                            const objects =
                              sequenceObjectsTobeShown?.[0]?.objects?.objects ??
                              [];
                            if (objects.length > 0) {
                              for (const object of objects) {
                                const index = accumulatedObjects.findIndex(
                                  (x) => x.modelId === object.modelId,
                                );
                                if (index >= 0) {
                                  accumulatedObjects[index].entityIds.push(
                                    object.id,
                                  );
                                } else {
                                  accumulatedObjects.push({
                                    modelId: object.modelId,
                                    entityIds: [object.id],
                                  });
                                }
                                await tcapi.viewer.isolateEntities(
                                  accumulatedObjects,
                                );
                                await tcapi.viewer.setObjectState(
                                  {
                                    modelObjectIds: [
                                      {
                                        modelId: object.modelId,
                                        objectRuntimeIds: [object.id],
                                      },
                                    ],
                                  },
                                  {
                                    color: {
                                      r: 252,
                                      g: 0,
                                      b: 0,
                                    },
                                    visible: true,
                                  },
                                );
                                await delay(timeStep);
                              }
                            }
                          } catch (error) {
                            console.error(
                              "Error processing sequence",
                              item.id,
                              error,
                            );
                          }
                        }}
                      />
                      <Popconfirm
                        title="Delete the step"
                        description="Are you sure to delete this step?"
                        onConfirm={() => {
                          const deleteSequenceBody = {
                            rootCommentId: rootCommentId,
                            sequences: sequences,
                            folderId: item.id,
                          };
                          console.log("deleteSequenceBody", deleteSequenceBody);
                          dispatch(DeleteSequenceRequest(deleteSequenceBody));
                        }}
                        okText="Yes"
                        cancelText="No"
                      >
                        <Button danger type="text" icon={<DeleteFilled />} />
                      </Popconfirm>
                    </div>
                  </SortableItem>
                )}
              />
            </SortableContext>
          </DndContext>
        </Card>
      </Content>
    </Layout>
  );
}

export default App;
