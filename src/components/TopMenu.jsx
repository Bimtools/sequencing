import { Button, Form, Modal, Tooltip, Input, Flex, Upload } from "antd";
import React from "react";
import {
  FolderAddOutlined,
  DownloadOutlined,
  FileSearchOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useDispatch, useSelector } from "react-redux";
import {
  CreatePlanRequest,
  SetActiveSimulationItem,
  UploadTemplateRequest,
  ExportTemplateRequest,
} from "../store/sequence/action";
import * as XLSX from "xlsx";
import * as WorkspaceAPI from "trimble-connect-workspace-api";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

const TopMenu = () => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();

  const plans = useSelector((state) => state.sequence.plans || []);
  const rootFolderId = useSelector((state) => state.sequence.rootFolderId);
  const rootCommentId = useSelector((state) => state.sequence.rootCommentId);
  const sequenceObjects = useSelector(
    (state) => state.sequence.sequenceObjects || [],
  );
  const startDate = useSelector((state) => state.sequence.startDate);

  const endDate = useSelector((state) => state.sequence.endDate);

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

  // const handleExportExcel = async () => {
  //   // const data = [];
  //   // let index = 0;

  //   // for (const group of sequenceObjects) {
  //   //   if (!group) continue;

  //   //   const plan = plans.find((x) => String(x.id) === String(group.planId));

  //   //   for (const obj of group.objects || []) {
  //   //     index += 1;

  //   //     data.push({
  //   //       group: plan?.name ?? "",
  //   //       asmPos: obj.asmPos,
  //   //       weight: obj.weight,
  //   //       location: obj.positionCode,
  //   //       date: obj.date || obj.assignedDate,
  //   //       sequenceNo: index,
  //   //     });
  //   //   }
  //   // }

  //   // exportToExcel(data, "Sequencing.xlsx");

  // };

  const getCellText = (cell) => {
    if (!cell?.value) return "";

    if (typeof cell.value === "string") return cell.value;

    if (cell.value.richText) {
      return cell.value.richText.map((x) => x.text).join("");
    }

    if (cell.value.text) return cell.value.text;
    if (cell.value.result) return String(cell.value.result);

    return "";
  };

  const clone = (value) => {
    if (value == null) return value;
    if (typeof value !== "object") return value;
    return JSON.parse(JSON.stringify(value));
  };

  const fillText = (value, data, keepMissing = true) => {
    if (typeof value !== "string") return value;

    return value.replace(/\{\{\s*(.*?)\s*\}\}/g, (match, key) => {
      const field = key.trim();

      if (Object.prototype.hasOwnProperty.call(data, field)) {
        return data[field] ?? "";
      }

      return keepMissing ? match : "";
    });
  };

  const fillRow = (row, data, keepMissing = false) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      const text = getCellText(cell);

      if (text) {
        cell.value = fillText(text, data, keepMissing);
      }
    });

    row.commit();
  };

  const fillHeader = (worksheet, data) => {
    worksheet.eachRow((row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        const text = getCellText(cell);

        if (text) {
          cell.value = fillText(text, data, true);
        }
      });

      row.commit();
    });
  };

  const findTemplateRows = (worksheet) => {
    let groupRowIndex = null;
    let itemRowIndex = null;

    worksheet.eachRow((row, rowNumber) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        const text = getCellText(cell);

        if (!text) return;

        if (text.includes("{{GroupDate}}") || text.includes("{{Qty}}")) {
          groupRowIndex = rowNumber;
        }

        if (
          text.includes("{{Index}}") ||
          text.includes("{{AsmName}}") ||
          text.includes("{{AsmPos}}")
        ) {
          itemRowIndex = rowNumber;
        }
      });
    });

    if (!groupRowIndex || !itemRowIndex) {
      throw new Error("Template thiếu {{GroupDate}}, {{Qty}} hoặc {{Index}}");
    }

    if (itemRowIndex <= groupRowIndex) {
      throw new Error("Dòng {{Index}} phải nằm dưới dòng {{GroupDate}}");
    }

    return {
      groupRowIndex,
      itemRowIndex,
    };
  };

  const copyRowTo = (worksheet, sourceRowNumber, targetRowNumber) => {
    worksheet.spliceRows(targetRowNumber, 0, []);

    const sourceRow = worksheet.getRow(sourceRowNumber);
    const targetRow = worksheet.getRow(targetRowNumber);

    targetRow.height = sourceRow.height;
    targetRow.hidden = sourceRow.hidden;
    targetRow.outlineLevel = sourceRow.outlineLevel;

    sourceRow.eachCell({ includeEmpty: true }, (sourceCell, col) => {
      const targetCell = targetRow.getCell(col);

      targetCell.value = clone(sourceCell.value);
      targetCell.style = clone(sourceCell.style);
      targetCell.numFmt = sourceCell.numFmt;
      targetCell.alignment = clone(sourceCell.alignment);
      targetCell.border = clone(sourceCell.border);
      targetCell.fill = clone(sourceCell.fill);
      targetCell.font = clone(sourceCell.font);
    });

    targetRow.commit();

    return targetRow;
  };

  const fillGroups = (worksheet, groups) => {
    const { groupRowIndex, itemRowIndex } = findTemplateRows(worksheet);

    let insertAt = itemRowIndex + 1;

    groups.forEach((group) => {
      const groupRow = copyRowTo(worksheet, groupRowIndex, insertAt);

      fillRow(groupRow, {
        GroupDate: group.date || "",
        Qty: group.items.length,
      });

      insertAt++;

      group.items.forEach((item, index) => {
        const itemRow = copyRowTo(worksheet, itemRowIndex, insertAt);

        fillRow(itemRow, {
          Index: index + 1,
          AsmName: item.AsmName || "",
          AsmPos: item.AsmPos || "",
          MainProfile: item.MainProfile || "",
          GridPos: item.GridPos || "",
          Length: item.Length || "",
          Weight: item.Weight || "",
          Comment: item.Comment || "",
        });

        insertAt++;
      });
      insertAt++;
    });

    worksheet.spliceRows(groupRowIndex, itemRowIndex - groupRowIndex + 1);
  };

  const buildGroups = () => {
    const dateGroups = {};

    sequenceObjects.forEach((group) => {
      (group.objects || []).forEach((obj) => {
        const date = obj.date || obj.assignedDate;

        const objDate = dayjs(date, "DD-MM-YYYY");
        const startDateReport = dayjs(startDate, "DD-MM-YYYY");
        const endDateReport = dayjs(endDate, "DD-MM-YYYY");
        if (startDate === null && endDate === null) {
          if (!dateGroups[date]) {
            dateGroups[date] = [];
          }

          dateGroups[date].push({
            AsmName: obj.name || obj.asmName || "",
            AsmPos: obj.asmPos || "",
            MainProfile: obj.profile || obj.mainProfile || "",
            GridPos: obj.positionCode || obj.gridPos || obj.location || "",
            Length: obj.length || "",
            Weight: Math.round(Number(obj.weight || 0) * 100) / 100,
            Comment: obj.comment || "",
          });
        } else if (startDate === null && objDate <= endDateReport) {
          if (!dateGroups[date]) {
            dateGroups[date] = [];
          }

          dateGroups[date].push({
            AsmName: obj.name || obj.asmName || "",
            AsmPos: obj.asmPos || "",
            MainProfile: obj.profile || obj.mainProfile || "",
            GridPos: obj.positionCode || obj.gridPos || obj.location || "",
            Length: obj.length || "",
            Weight: Math.round(Number(obj.weight || 0) * 100) / 100,
            Comment: obj.comment || "",
          });
        } else if (endDate === null && objDate >= startDateReport) {
          if (!dateGroups[date]) {
            dateGroups[date] = [];
          }

          dateGroups[date].push({
            AsmName: obj.name || obj.asmName || "",
            AsmPos: obj.asmPos || "",
            MainProfile: obj.profile || obj.mainProfile || "",
            GridPos: obj.positionCode || obj.gridPos || obj.location || "",
            Length: obj.length || "",
            Weight: Math.round(Number(obj.weight || 0) * 100) / 100,
            Comment: obj.comment || "",
          });
        } else if (startDate <= objDate && objDate <= endDateReport) {
          if (!dateGroups[date]) {
            dateGroups[date] = [];
          }

          dateGroups[date].push({
            AsmName: obj.name || obj.asmName || "",
            AsmPos: obj.asmPos || "",
            MainProfile: obj.profile || obj.mainProfile || "",
            GridPos: obj.positionCode || obj.gridPos || obj.location || "",
            Length: obj.length || "",
            Weight: Math.round(Number(obj.weight || 0) * 100) / 100,
            Comment: obj.comment || "",
          });
        }
      });
    });

    return Object.entries(dateGroups)
      .sort(
        ([dateA], [dateB]) =>
          dayjs(dateA, "DD-MM-YYYY") - dayjs(dateB, "DD-MM-YYYY"),
      )
      .map(([date, items]) => ({
        date,
        items,
      }));
  };

  const handleExportExcel = async () => {
    try {
      const tcapi = await WorkspaceAPI.connect(window.parent);
      const project = await tcapi.project.getProject();

      const response = await fetch(
        `${process.env.PUBLIC_URL}/Erection_Template.xlsx`,
      );

      if (!response.ok) {
        throw new Error("Erection_Template.xlsx is not available in public");
      }

      const buffer = await response.arrayBuffer();

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const worksheet = workbook.worksheets[0];

      if (!worksheet) {
        throw new Error("Template has no worksheet");
      }

      fillHeader(worksheet, {
        ProjectName: project.name,
        ReportDate: new Date().toLocaleDateString("vi-VN"),
      });

      fillGroups(worksheet, buildGroups());

      const output = await workbook.xlsx.writeBuffer();

      saveAs(
        new Blob([output], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        "Sequencing.xlsx",
      );
    } catch (error) {
      console.error(error);
    }
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
