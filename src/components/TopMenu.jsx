import { Button, Form, Modal, Tooltip, Input, Flex, Upload } from "antd";
import React from "react";
import {
  FolderAddOutlined,
  DownloadOutlined,
  FileSearchOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import {
  CreatePlanRequest,
  SetActiveSimulationItem,
} from "../store/sequence/action";
import * as XLSX from "xlsx";
import * as WorkspaceAPI from "trimble-connect-workspace-api";

const TopMenu = () => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();

  const plans = useSelector((state) => state.sequence.plans || []);
  const rootFolderId = useSelector((state) => state.sequence.rootFolderId);
  const rootCommentId = useSelector((state) => state.sequence.rootCommentId);
  const sequenceObjects = useSelector(
    (state) => state.sequence.sequenceObjects || [],
  );

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const planName = Form.useWatch("planName", form);

  const handleCreate = async () => {
    const values = await form.validateFields();

    dispatch(
      CreatePlanRequest({
        name: values.planName,
        rootCommentId,
        rootFolderId,
        plans,
      }),
    );

    form.resetFields();
    setIsModalOpen(false);
  };

  const handleCancel = () => {
    form.resetFields();
    setIsModalOpen(false);
  };

  const exportToExcel = (data, fileName = "Sequencing.xlsx") => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    XLSX.writeFile(workbook, fileName);
  };

  const handleHighlight = async () => {
    const tcapi = await WorkspaceAPI.connect(window.parent);

    const selections = await tcapi.viewer.getSelection();
    if (!selections?.length) return;

    const modelId = selections[0].modelId;
    const runtimeId = selections[0].objectRuntimeIds?.[0];

    if (!modelId || !runtimeId) return;

    let found = null;

    for (const group of sequenceObjects) {
      const objects = group.objects || [];

      const obj = objects.find((x) => {
        const objRuntimeId = x.id || x.runtimeId || x.objectRuntimeId;
        const objModelId = x.modelId || group.modelId;

        return (
          String(objModelId) === String(modelId) &&
          String(objRuntimeId) === String(runtimeId)
        );
      });

      if (obj) {
        found = {
          planId: group.planId || group.id || obj.planId,
          subPlanId: group.subPlanId || obj.subPlanId,
          modelId,
          runtimeId,
        };

        break;
      }
    }

    if (!found) return;

    dispatch(
      SetActiveSimulationItem({
        planId: String(found.planId),
        subPlanId: String(found.subPlanId),
        modelId: found.modelId,
        id: String(found.runtimeId),
        runtimeId: found.runtimeId,
      }),
    );
  };

  const handleUploadTemplate = async (file) => {
    console.log("Template:", file);
    
    return false;
  };

  const handleExportExcel = () => {
    const data = [];
    let index = 0;

    for (const group of sequenceObjects) {
      if (!group) continue;

      const plan = plans.find((x) => String(x.id) === String(group.planId));

      for (const obj of group.objects || []) {
        index += 1;

        data.push({
          group: plan?.name ?? "",
          asmPos: obj.asmPos,
          weight: obj.weight,
          location: obj.positionCode,
          date: obj.date || obj.assignedDate,
          sequenceNo: index,
        });
      }
    }

    exportToExcel(data, "Sequencing.xlsx");
  };

  return (
    <>
      <Modal
        title="Create New Plan"
        open={isModalOpen}
        onCancel={handleCancel}
        footer={null}
        styles={{
          header: {
            padding: 0,
            marginBottom: 0,
          },
          body: {
            padding: 0,
          },
        }}
      >
        <Form form={form} autoComplete="off" layout="vertical">
          <Form.Item
            name="planName"
            style={{ marginBottom: 2 }}
            rules={[
              {
                required: true,
                message: "Please enter plan name",
              },
            ]}
          >
            <Input placeholder="Plan Name" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              disabled={!planName?.trim()}
              onClick={handleCreate}
            >
              Create
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Flex
        justify="space-between"
        align="center"
        style={{ padding: "0 16px" }}
      >
        <h1 style={{ margin: 0, fontSize: 18 }}>Sequencing</h1>

        <div>
          <Tooltip title="Upload Excel Template">
            <Upload
              accept=".xlsx"
              showUploadList={false}
              beforeUpload={handleUploadTemplate}
            >
              <Button
                size="large"
                type="text"
                icon={<UploadOutlined style={{ fontSize: 22 }} />}
              />
            </Upload>
          </Tooltip>
          <Tooltip title="Create new plan">
            <Button
              size="large"
              type="text"
              icon={<FolderAddOutlined style={{ fontSize: 22 }} />}
              onClick={() => setIsModalOpen(true)}
            />
          </Tooltip>

          <Tooltip title="Export to Excel">
            <Button
              size="large"
              type="text"
              icon={<DownloadOutlined style={{ fontSize: 22 }} />}
              onClick={handleExportExcel}
            />
          </Tooltip>

          <Tooltip title="Highlight row from selected object">
            <Button
              size="large"
              type="text"
              icon={<FileSearchOutlined style={{ fontSize: 22 }} />}
              onClick={handleHighlight}
            />
          </Tooltip>
        </div>
      </Flex>
    </>
  );
};

export default TopMenu;
