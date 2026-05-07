import logo from "./logo.svg";
import "./App.css";
import * as WorkspaceAPI from "trimble-connect-workspace-api";
import * as XLSX from "xlsx";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  MenuOutlined,
  DeleteFilled,
  PlusOutlined,
  MinusOutlined,
  PlayCircleOutlined,
  PlayCircleFilled,
  FileOutlined,
  CloseOutlined,
  DownOutlined,
  DownloadOutlined,
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
  Splitter,
  Form,
  Modal,
} from "antd";
import { Colorpicker, ColorPickerValue } from "antd-colorpicker";

import {
  GetSequenceRequest,
  CreateSequenceRequest,
  UpdateCommentRequest,
  DeleteFolderRequest,
  SetObjectsRequest,
  DeleteSequenceRequest,
  SelectObjectsSuccess,
} from "./store/sequence/action";
const { Header, Content } = Layout;
const { Title, Text } = Typography;
const math = require("mathjs");

function App() {
  const dispatch = useDispatch();
  const sequenceState = useSelector((state) => state.sequence);
  const sequences = useSelector((state) => state.sequence.sequences);
  const sequenceObjects = useSelector(
    (state) => state.sequence.sequenceObjects,
  );
  const selectedObjects = useSelector(
    (state) => state.sequence.selectedObjects,
  );
  const selectedGroup = useSelector((state) => state.sequence.selectedGroup);
  const rootFolderId = useSelector((state) => state.sequence.rootFolderId);
  const rootCommentId = useSelector((state) => state.sequence.rootCommentId);
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [step, setStep] = useState("");
  const [timeStep, setTimeStep] = useState(100);
  const [colorDialog, setColorDialog] = useState(false);
  const [color, setColor] = useState({
    rgb: {
      r: 248,
      b: 234,
      g: 28,
    },
  });

  function exportToExcel(data, fileName = "Sequencing.xlsx") {
    const worksheet = XLSX.utils.json_to_sheet(data);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    XLSX.writeFile(workbook, fileName);
  }
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
  const onDragEndSubItem = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const newArray = (prev) => {
        const oldIndex = prev.findIndex((x) => x.id === active.id);
        const newIndex = prev.findIndex((x) => x.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      };
      const newObjects = newArray(selectedObjects);
      const newSequenceObjects = {
        folderId: selectedGroup,
        objects: newObjects,
      };
      dispatch(SetObjectsRequest(newSequenceObjects));
      dispatch(SelectObjectsSuccess(newSequenceObjects));
    }
  };
  function SortableItem({ item, icon, children, sequenceObjects }) {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: item.id });
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      background: `rgb(${item.color.r}, ${item.color.g}, ${item.color.b},0.8)`,
    };
    console.log(item);
    return (
      <List.Item
        ref={setNodeRef}
        style={style}
        {...attributes}
        onClick={() => {
          const selectedObjects = sequenceObjects.filter(
            (x) => x && x.folderId === item.id,
          );
          console.log(selectedObjects);
          const items =
            selectedObjects.length > 0 ? selectedObjects[0].objects : [];
          const runtimeIds = items.map((x) => {
            return {
              modelId: x.modelId,
              objectRuntimeIds: [x.id],
            };
          });
          console.log(runtimeIds);
          setStep(item.name);
          setColor({ rgb: item.color });
          // const tcapi = await WorkspaceAPI.connect(window.parent);
          // await tcapi.viewer.setSelection(
          //   {
          //     modelObjectIds: runtimeIds,
          //   },
          //   "set",
          // );
          dispatch(
            SelectObjectsSuccess(
              selectedObjects[0] ?? {
                folderId: item.id,
                objects: [],
              },
            ),
          );
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          {icon && (
            <span {...listeners} style={{ cursor: "grab", marginRight: 12 }}>
              {icon}
            </span>
          )}
          <strong>{item.name}</strong>
        </div>
        {children}
      </List.Item>
    );
  }
  function SortableSubItem({ item, icon, children }) {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: item.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    return (
      <List.Item
        ref={setNodeRef}
        style={style}
        {...attributes}
        onClick={async () => {
          const tcapi = await WorkspaceAPI.connect(window.parent);
          await tcapi.viewer.setSelection(
            {
              modelObjectIds: [
                {
                  modelId: item.modelId,
                  objectRuntimeIds: [item.id],
                },
              ],
            },
            "set",
          );
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          {icon && (
            <span {...listeners} style={{ cursor: "grab", marginRight: 12 }}>
              {icon}
            </span>
          )}
          <strong>{item.asmPos === "" ? item.id : item.asmPos}</strong>
        </div>
        {children}
      </List.Item>
    );
  }

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
                  const selectedSequence = sequences.filter(
                    (x) => x.id == sequence.id,
                  );
                  try {
                    const objects =
                      sequenceObjectsTobeShown?.[0]?.objects ?? [];
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
                              r: selectedSequence[0].color.r,
                              g: selectedSequence[0].color.g,
                              b: selectedSequence[0].color.b,
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
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => {
                const data = [];
                var index = 0;
                for (const key in sequenceObjects) {
                  const item = sequenceObjects[key];
                  if (!item) continue;

                  const sequence = sequences.filter(
                    (x) => x.id === item.folderId,
                  );
                  console.log(item);
                  for (const obj of item.objects) {
                    index = index + 1;
                    data.push({
                      group: sequence[0]?.name ?? "",
                      asmPos: obj.asmPos,
                      location: obj.positionCode,
                      sequenceNo: index,
                    });
                  }
                }
                exportToExcel(data, "Sequencing.xlsx");
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              maxWidth: "350px",
              marginTop: 2,
              gap: 5,
            }}
          >
            <Input
              style={{ flex: 1 }}
              placeholder="Group Name"
              value={step}
              onChange={(e) => setStep(e.target.value)}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flexDirection: "row",
                columnGap: "2px",
              }}
            >
              <div
                type="primary"
                onClick={() => setColorDialog(!colorDialog)}
                style={{
                  background: `rgb(${color.rgb.r ?? 0},${color.rgb.g ?? 0},${color.rgb.b ?? 0})`,
                }}
              >
                          
              </div>
              <Modal
                width={270}
                title="Color"
                open={colorDialog}
                footer={null}
                onCancel={() => {
                  setColorDialog(!colorDialog);
                }}
              >
                <Colorpicker
                  value={color}
                  onChange={(value) => {
                    setColor(value);
                  }}
                />
              </Modal>
            </div>
            <Button
              type="primary"
              style={{ width: 66 }}
              onClick={() => {
                dispatch(
                  CreateSequenceRequest({
                    name: step,
                    color: color.rgb,
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
            <Button
              type="primary"
              style={{ width: 65 }}
              onClick={() => {
                console.log(step);
                console.log(selectedGroup);
                const newSequences = sequences.map((x) =>
                  x.id !== selectedGroup
                    ? x
                    : { ...x, name: step, color: color.rgb },
                );
                console.log(newSequences);
                dispatch(
                  UpdateCommentRequest({
                    commentId: rootCommentId,
                    sequences: newSequences,
                  }),
                );
              }}
            >
              Modify
            </Button>
          </div>
          <Splitter
            style={{
              height: "100%",
              marginTop: "10px",
              boxShadow: "0 0 10px rgba(0, 0, 0, 0.1)",
            }}
          >
            <Splitter.Panel defaultSize="70%" min="20%" max="80%">
              <DndContext onDragEnd={onDragEnd}>
                <SortableContext
                  items={sequences.map((x) => x.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <List
                    style={{ minWidth: "250px", marginLeft: "10px" }}
                    loading={sequenceState.pending}
                    dataSource={sequences}
                    renderItem={(item) => (
                      <SortableItem
                        key={item.id}
                        item={item}
                        icon={<MenuOutlined />}
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
                              const selections =
                                await tcapi.viewer.getSelection();

                              tcapi.viewer.activateTool("pointMarkup");
                              // handler stored so it can be removed later
                              const onMessage = async (event) => {
                                if (
                                  event.data.event === "viewer.onMarkupChanged"
                                ) {
                                  window.removeEventListener(
                                    "message",
                                    onMessage,
                                  );
                                  const start =
                                    event.data.data.data.markup.start;
                                  const refPoint = [
                                    Number(start.positionX),
                                    Number(start.positionY),
                                    Number(start.positionZ),
                                  ];
                                  var newAddedSequenceObjects = [];

                                  for (const selection of selections) {
                                    const objBoxes =
                                      await tcapi.viewer.getObjectBoundingBoxes(
                                        selection.modelId,
                                        selection.objectRuntimeIds,
                                      );
                                    const items =
                                      await tcapi.viewer.getObjectProperties(
                                        selection.modelId,
                                        selection.objectRuntimeIds,
                                      );

                                    for (let i = 0; i < objBoxes.length; i++) {
                                      const box = objBoxes[i];
                                      const center = math.divide(
                                        math.add(
                                          [
                                            1000 * box.boundingBox.min.x,
                                            1000 * box.boundingBox.min.y,
                                            1000 * box.boundingBox.min.z,
                                          ],
                                          [
                                            1000 * box.boundingBox.max.x,
                                            1000 * box.boundingBox.max.y,
                                            1000 * box.boundingBox.max.z,
                                          ],
                                        ),
                                        2,
                                      );
                                      const properties = items[i].properties;
                                      let asm_pos = "";
                                      let positionCode = "";
                                      properties.every((property) => {
                                        if (property.name === "ASSEMBLY") {
                                          const asm_properties =
                                            property.properties;
                                          asm_properties.every(
                                            (asm_property) => {
                                              if (
                                                asm_pos !== "" &&
                                                positionCode !== ""
                                              )
                                                return false;
                                              if (
                                                asm_property.name.trim() ===
                                                "ASSEMBLY_POS"
                                              ) {
                                                asm_pos =
                                                  asm_property.value.replace(
                                                    "(?)",
                                                    "",
                                                  );
                                              }

                                              return true;
                                            },
                                          );
                                          return false;
                                        } else if (
                                          property.name.trim() ===
                                          "Tekla Assembly"
                                        ) {
                                          const asm_properties =
                                            property.properties;
                                          asm_properties.every(
                                            (asm_property) => {
                                              if (
                                                asm_pos !== "" &&
                                                positionCode !== ""
                                              )
                                                return false;
                                              if (
                                                asm_property.name.trim() ===
                                                "Assembly/Cast unit Mark"
                                              ) {
                                                asm_pos = asm_property.value;
                                              }
                                              if (
                                                asm_property.name.trim() ===
                                                "Assembly/Cast unit position code"
                                              ) {
                                                positionCode =
                                                  asm_property.value;
                                              }
                                              return true;
                                            },
                                          );
                                          return false;
                                        }
                                        return true;
                                      });

                                      const distance = math.distance(
                                        refPoint,
                                        center,
                                      );

                                      newAddedSequenceObjects.push({
                                        modelId: selection.modelId,
                                        id: box.id,
                                        distance: math.round(distance),
                                        asmPos: asm_pos,
                                        positionCode: positionCode,
                                      });
                                    }
                                  }
                                  newAddedSequenceObjects.sort((a, b) => {
                                    return (
                                      Number(a.distance) - Number(b.distance)
                                    );
                                  });
                                  const existingObjects =
                                    sequenceObjects.filter(
                                      (x) => x && x.folderId === item.id,
                                    )[0]?.objects ?? [];

                                  var newObjects = [...existingObjects];
                                  newObjects.push(...newAddedSequenceObjects);
                                  const newSequenceObjects = {
                                    folderId: item.id,
                                    objects: newObjects,
                                  };
                                  console.log(newSequenceObjects);
                                  dispatch(
                                    SetObjectsRequest(newSequenceObjects),
                                  );
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
                                  (x) => x && x.folderId === item.id,
                                );
                              const selectedSequence = sequences.filter(
                                (x) => x.id == item.id,
                              );
                              console.log(selectedSequence);
                              try {
                                const objects =
                                  sequenceObjectsTobeShown?.[0]?.objects ?? [];
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
                                          r: selectedSequence[0].color.r,
                                          g: selectedSequence[0].color.g,
                                          b: selectedSequence[0].color.b,
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
                              console.log(
                                "deleteSequenceBody",
                                deleteSequenceBody,
                              );
                              dispatch(
                                DeleteSequenceRequest(deleteSequenceBody),
                              );
                            }}
                            okText="Yes"
                            cancelText="No"
                          >
                            <Button type="text" icon={<DeleteFilled />} />
                          </Popconfirm>
                        </div>
                      </SortableItem>
                    )}
                  />
                </SortableContext>
              </DndContext>
            </Splitter.Panel>
            <Splitter.Panel>
              <DndContext onDragEnd={onDragEndSubItem}>
                <SortableContext
                  items={selectedObjects.map((x) => x.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <List
                    style={{
                      marginLeft: "10px",
                      minWidth: "100px",
                      height: "600px",
                    }}
                    loading={sequenceState.pending}
                    dataSource={selectedObjects}
                    renderItem={(item) => (
                      <SortableSubItem
                        key={`${item.modelId}${item.id}`}
                        item={item}
                        icon={<FileOutlined />}
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
                            icon={<CloseOutlined />}
                            onClick={() => {
                              const filteredObjects = selectedObjects.filter(
                                (obj) =>
                                  !(
                                    obj.modelId === item.modelId &&
                                    obj.id === item.id
                                  ),
                              );
                              const newSequenceObjects = {
                                folderId: selectedGroup,
                                objects: filteredObjects,
                              };
                              dispatch(SetObjectsRequest(newSequenceObjects));
                              dispatch(
                                SelectObjectsSuccess(newSequenceObjects),
                              );
                            }}
                          />
                        </div>
                      </SortableSubItem>
                    )}
                  />
                </SortableContext>
              </DndContext>
            </Splitter.Panel>
          </Splitter>
        </Card>
      </Content>
    </Layout>
  );
}

export default App;
