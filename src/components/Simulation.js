import { Button, Slider, Space } from "antd";
import {
  StepBackwardOutlined,
  StepForwardOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

const items = [
  { id: 1, name: "216", value: 0 },
  { id: 2, name: "Step 1", value: 20 },
  { id: 3, name: "Step 2", value: 40 },
  { id: 4, name: "Step 3", value: 60 },
  { id: 5, name: "216", value: 100 },
];

export default function Simulation() {
  const dispatch = useDispatch();
  const sequenceState = useSelector((state) => state.sequence);
  const sequences = useSelector((state) => state.sequence.sequences);
  const sequencesToBeCopied = useSelector(
    (state) => state.sequence.sequencesToBeCopied,
  );
  const phases = useSelector((state) => state.sequence.phases);
  const sequenceObjects = useSelector(
    (state) => state.sequence.sequenceObjects,
  );
  const selectedObjects = useSelector(
    (state) => state.sequence.selectedObjects,
  );
  const selectedGroup = useSelector((state) => state.sequence.selectedGroup);
  const rootFolderId = useSelector((state) => state.sequence.rootFolderId);
  const rootCommentId = useSelector((state) => state.sequence.rootCommentId);
  const phaseCommentId = useSelector((state) => state.sequence.phaseCommentId);
  const [index, setIndex] = useState(0);

  const current = items[index];

  const next = () => {
    setIndex((i) => Math.min(i + 1, items.length - 1));
  };

  const prev = () => {
    setIndex((i) => Math.max(i - 1, 0));
  };

  const marks = items.reduce((acc, item, i) => {
    acc[item.value] = {
      label: <div onClick={() => setIndex(i)} />,
    };
    return acc;
  }, {});

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 8 }}>
        <b>{current.name}</b>
      </div>

      <Slider
        min={0}
        max={100}
        value={current.value}
        marks={marks}
        tooltip={{ open: false }}
        onChange={(value) => {
          const nearestIndex = items.reduce((best, item, i) => {
            return Math.abs(item.value - value) <
              Math.abs(items[best].value - value)
              ? i
              : best;
          }, 0);

          setIndex(nearestIndex);
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: 24,
        }}
      >
        <Space>
          <Button icon={<StepBackwardOutlined />} onClick={prev} />
          <Button
            type="primary"
            shape="circle"
            icon={<PlayCircleOutlined />}
            onClick={next}
          />
          <Button icon={<StepForwardOutlined />} onClick={next} />
        </Space>
      </div>
    </div>
  );
}
