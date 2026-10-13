// Screenshot entry for Digital Exposure and Sleep. Same review-then-save flow.
import { useState } from "react";
import { DateStepper } from "@/components/DateStepper";
import { SubScreen } from "@/components/Layout";
import ScreenshotImport from "@/components/ScreenshotImport";
import { EntryMethodTabs } from "@/screens/ExposureManual";
import { useMe } from "@/lib/api";
import { addDays, localToday } from "@/lib/dates";

export function ExposureScreenshotScreen() {
  const today = localToday();
  const [date, setDate] = useState(addDays(today, -1));
  const { data: me } = useMe();
  return (
    <SubScreen back={{ href: "/", label: "Brief" }} title="Digital Exposure"
      meta={<DateStepper date={date} onChange={setDate} max={today} />} demo={me?.isDemo}>
      <EntryMethodTabs active="screenshot" />
      <ScreenshotImport kind="screen_time" date={date} />
    </SubScreen>
  );
}

export function SleepScreenshotScreen() {
  const today = localToday();
  const [wake, setWake] = useState(today);
  const { data: me } = useMe();
  return (
    <SubScreen back={{ href: "/log/sleep", label: "Sleep" }} title="Sleep screenshot"
      meta={<DateStepper date={addDays(wake, -1)} onChange={d => setWake(addDays(d, 1))} max={addDays(today, -1)} prefix="NIGHT OF " />}
      demo={me?.isDemo}>
      <ScreenshotImport kind="sleep" date={wake} />
    </SubScreen>
  );
}
