import { Button, Slider, Space, DatePicker } from "antd";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import {
  StepBackwardOutlined,
  StepForwardOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
} from "@ant-design/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import * as WorkspaceAPI from "trimble-connect-workspace-api";
import { SetActiveSimulationItem } from "../store/sequence/action";

dayjs.extend(customParseFormat);
export default function Simulation() {
  const dispatch = useDispatch();

  const sequenceObjects = useSelector(
    (state) => state.sequence.sequenceObjects || [],
  );

  const subPlans = useSelector((state) => state.sequence.subPlans || []);

  const tcapiRef = useRef(null);
  const intervalRef = useRef(null);

  const dates = useMemo(() => {
    const dateSet = new Set();

    sequenceObjects.forEach((group) => {
      (group.objects || []).forEach((obj) => {
        const date = obj.assignedDate || obj.date;
        if (date) {
          dateSet.add(date);
        }
      });
    });

    return [...dateSet].sort(
      (a, b) =>
        dayjs(a, "DD-MM-YYYY").valueOf() - dayjs(b, "DD-MM-YYYY").valueOf(),
    );
  }, [sequenceObjects]);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [delay, setDelay] = useState(200);
  const [range, setRange] = useState([0, 0]);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  useEffect(() => {
    if (dates.length) {
      setRange([0, dates.length - 1]);
    }
  }, [dates]);

  // const startDate = dates[range[0]];
  // const endDate = dates[range[1]];

  const allItems = useMemo(() => {
    if (!sequenceObjects.length) return [];

    const result = [];
    let originalIndex = 0;

    sequenceObjects.forEach((group, groupIndex) => {
      const objects = group.objects || [];

      objects.forEach((obj, objectIndex) => {
        const runtimeId = obj.id || obj.runtimeId || obj.objectRuntimeId;
        const planId = group.planId || group.id || obj.planId;
        const subPlanId = group.subPlanId || obj.subPlanId;
        const simulationDate = obj.assignedDate || obj.date;

        result.push({
          ...obj,
          planId: String(planId),
          subPlanId: String(subPlanId),
          groupIndex,
          objectIndex,
          originalIndex: originalIndex++,
          planName:
            group.name ||
            group.planName ||
            group.subPlanName ||
            `Plan ${groupIndex + 1}`,
          name:
            obj.asmPos ||
            obj.name ||
            obj.objectName ||
            `Object ${objectIndex + 1}`,
          modelId: obj.modelId,
          runtimeId,
          id: String(runtimeId),
          simulationDate,
          simulationTime: dayjs(simulationDate, "DD-MM-YYYY").valueOf(),
        });
      });
    });

    return result.sort((a, b) => {
      if (a.simulationTime !== b.simulationTime) {
        return a.simulationTime - b.simulationTime;
      }
      return a.originalIndex - b.originalIndex;
    });
  }, [sequenceObjects]);

  const items = useMemo(() => {
    const filtered = allItems.filter((item) => {
      if (!startDate || !endDate) return true;
      if (!item.simulationDate) return false;
      const simulationDate = dayjs(item.simulationDate, "DD-MM-YYYY");

      return simulationDate >= startDate && simulationDate <= endDate;
    });

    return filtered.map((item, i) => ({
      ...item,
      value:
        filtered.length === 1
          ? 0
          : Math.round((i / (filtered.length - 1)) * 100),
    }));
  }, [allItems, startDate, endDate]);

  const current = items[index];

  useEffect(() => {
    if (index >= items.length) {
      setIndex(0);
    }
  }, [items.length, index]);

  const getTcapi = async () => {
    if (!tcapiRef.current) {
      tcapiRef.current = await WorkspaceAPI.connect(window.parent);
    }

    return tcapiRef.current;
  };

  const buildAccumulatedObjects = useCallback(
    (toIndex) => {
      const grouped = [];

      items.slice(0, toIndex + 1).forEach((item) => {
        if (!item.modelId || !item.runtimeId) return;

        const exist = grouped.find((x) => x.modelId === item.modelId);

        if (exist) {
          exist.entityIds.push(item.runtimeId);
        } else {
          grouped.push({
            modelId: item.modelId,
            entityIds: [item.runtimeId],
          });
        }
      });

      return grouped;
    },
    [items],
  );

  const selectObjectInTrimble = async (item) => {
    if (!item?.modelId || !item?.runtimeId) return;

    const tcapi = await getTcapi();

    await tcapi.viewer.setSelection(
      {
        modelObjectIds: [
          {
            modelId: item.modelId,
            objectRuntimeIds: [item.runtimeId],
          },
        ],
      },
      "set",
    );
  };

  const colorObjectInTrimble = async (item) => {
    if (!item?.modelId || !item?.runtimeId) return;

    const subPlan = subPlans.find(
      (x) => String(x.id) === String(item.subPlanId),
    );

    if (!subPlan?.color) return;

    const tcapi = await getTcapi();

    await tcapi.viewer.setObjectState(
      {
        modelObjectIds: [
          {
            modelId: item.modelId,
            objectRuntimeIds: [item.runtimeId],
          },
        ],
      },
      {
        color: {
          r: subPlan.color.r,
          g: subPlan.color.g,
          b: subPlan.color.b,
        },
        visible: true,
      },
    );
  };

  const isolateObjectsInTrimble = async (objects) => {
    if (!objects?.length) return;

    const tcapi = await getTcapi();

    await tcapi.viewer.isolateEntities(objects);
  };

  const goToIndex = useCallback(
    async (newIndex) => {
      if (!items.length) return;

      const safeIndex = Math.max(0, Math.min(newIndex, items.length - 1));
      const item = items[safeIndex];

      setIndex(safeIndex);

      dispatch(
        SetActiveSimulationItem({
          planId: String(item.planId),
          subPlanId: String(item.subPlanId),
          modelId: item.modelId,
          id: String(item.id),
          runtimeId: item.runtimeId,
        }),
      );

      const accumulatedObjects = buildAccumulatedObjects(safeIndex);

      await isolateObjectsInTrimble(accumulatedObjects);
      await colorObjectInTrimble(item);
      await selectObjectInTrimble(item);
    },
    [items, dispatch, buildAccumulatedObjects, subPlans],
  );

  const next = () => {
    setPlaying(false);
    goToIndex(index + 1);
  };

  const prev = () => {
    setPlaying(false);
    goToIndex(index - 1);
  };

  const togglePlay = async () => {
    if (!items.length) return;

    if (!playing) {
      if (index >= items.length - 1) {
        await goToIndex(0);
      } else {
        await goToIndex(index);
      }
    }

    setPlaying((prev) => !prev);
  };

  useEffect(() => {
    if (!playing || !items.length) {
      clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      const nextIndex = index + 1;

      if (nextIndex >= items.length) {
        clearInterval(intervalRef.current);
        setPlaying(false);
        return;
      }

      goToIndex(nextIndex);
    }, delay);

    return () => clearInterval(intervalRef.current);
  }, [playing, delay, index, items.length, goToIndex]);

  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
    };
  }, []);

  const marks = items.reduce((acc, item, i) => {
    acc[item.value] = {
      label: (
        <div
          onClick={() => {
            setPlaying(false);
            goToIndex(i);
          }}
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            cursor: "pointer",
          }}
        />
      ),
    };

    return acc;
  }, {});

  if (!allItems.length) {
    return <div>There is no simulation data available</div>;
  }

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          columnGap: 8,
          marginBottom: 24,
        }}
      >
        <DatePicker
          size="small"
          format="DD-MM-YYYY"
          placeholder="Start Date"
          value={startDate}
          onChange={(date) => setStartDate(date)}
        />

        <DatePicker
          size="small"
          format="DD-MM-YYYY"
          placeholder="End Date"
          value={endDate}
          onChange={(date) => setEndDate(date)}
        />
        {/* <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              Start: <b>{startDate || "-"}</b> - End: <b>{endDate || "-"}</b>
            </div> */}

        {/* <Slider
              range
              min={0}
              max={Math.max(dates.length - 1, 0)}
              step={1}
              dots
              value={range}
              disabled={!dates.length}
              onChange={(value) => {
                setPlaying(false);
                setIndex(0);
                setRange(value);
              }}
              tooltip={{
                formatter: (value) => dates[value],
              }}
            /> */}
      </div>
      {!items.length ? (
        <div>No objects in selected date range</div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
              fontWeight: 600,
              fontSize: 16,
            }}
          >
            <span>{`${current?.asmPos ?? ""} Grid: ${current?.positionCode}`}</span>
            <span>{`${Number(Number(current?.weight || 0).toFixed(2))}kg`}</span>

            <span>{current?.simulationDate || "-"}</span>
          </div>

          <Slider
            style={{ width: "100%" }}
            min={0}
            max={100}
            value={current?.value}
            marks={marks}
            tooltip={{ open: false }}
            onChange={(value) => {
              const nearestIndex = items.reduce((best, item, i) => {
                return Math.abs(item.value - value) <
                  Math.abs(items[best].value - value)
                  ? i
                  : best;
              }, 0);

              setPlaying(false);
              goToIndex(nearestIndex);
            }}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: 16,
            }}
          >
            <Space>
              <Button
                icon={<StepBackwardOutlined />}
                onClick={prev}
                disabled={index === 0}
              />

              <Button
                type="primary"
                shape="circle"
                icon={
                  playing ? <PauseCircleOutlined /> : <PlayCircleOutlined />
                }
                onClick={togglePlay}
              />

              <Button
                icon={<StepForwardOutlined />}
                onClick={next}
                disabled={index === items.length - 1}
              />
            </Space>
          </div>

          <div style={{ marginTop: 12 }}>
            <span>Timing: {delay} ms</span>

            <Slider
              min={50}
              max={5000}
              step={50}
              value={delay}
              onChange={setDelay}
              tooltip={{
                formatter: (value) => `${value} ms`,
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
