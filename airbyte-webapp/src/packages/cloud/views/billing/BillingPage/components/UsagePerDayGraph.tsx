import classnames from "classnames";
import dayjs from "dayjs";
import { useMemo } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { FlexContainer } from "components/ui/Flex";
import { Text } from "components/ui/Text";

import { useFreeConnectorProgram } from "packages/cloud/components/experiments/FreeConnectorProgram";
import { ConsumptionPerConnectionPerTimeframe } from "packages/cloud/lib/domain/cloudWorkspaces/types";

import { EmptyState } from "./EmptyState";
import styles from "./UsagePerDayGraph.module.scss";

interface UsagePerDayGraphProps {
  chartData: Array<Omit<ConsumptionPerConnectionPerTimeframe, "connection">>;
  minimized?: boolean;
}
export const UsagePerDayGraph: React.FC<UsagePerDayGraphProps> = ({ chartData, minimized }) => {
  const {
    enrollmentStatusQuery: { data: freeConnectorEnrollment },
  } = useFreeConnectorProgram();
  const isEnrolledInFreeConnectorProgram = freeConnectorEnrollment?.isEnrolled;
  const { formatMessage } = useIntl();
  const { formatNumber } = useIntl();
  const chartLinesColor = styles.grey100;
  const chartTicksColor = styles.grey;
  const chartHoverFill = styles.grey100;

  const width = useMemo(() => {
    if (chartData.length === 0) {
      return;
    }

    if (minimized) {
      return 10;
    }

    return Math.min(
      Math.max([...chartData].sort((a, b) => b.freeUsage - a.freeUsage)[0].freeUsage.toFixed(0).length * 10, 80),
      130
    );
  }, [chartData, minimized]);

  return (
    <div className={classnames({ [styles.container]: !minimized })}>
      {chartData && chartData.length > 0 ? (
        <ResponsiveContainer width={minimized ? 120 : undefined} height={minimized ? 30 : undefined}>
          <BarChart data={chartData} margin={minimized ? {} : { right: 12, top: 25 }}>
            {!minimized && (
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                height={40}
                wrapperStyle={{ color: `${styles.white}` }}
                formatter={(value) => {
                  return (
                    <Text as="span">
                      <FormattedMessage id={`credits.${value}`} />
                    </Text>
                  );
                }}
              />
            )}
            {!minimized && <CartesianGrid vertical={false} stroke={chartLinesColor} />}
            <XAxis
              dataKey="timeframe"
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => dayjs(value).format("MMM D")}
              stroke={chartTicksColor}
              tick={{ fontSize: "11px" }}
              tickSize={7}
              hide={minimized}
            />

            {minimized && <ReferenceLine y={0} stroke={chartLinesColor} />}
            <YAxis
              axisLine={false}
              tickLine={false}
              stroke={chartTicksColor}
              tick={{ fontSize: "11px" }}
              tickSize={10}
              width={width}
              hide={minimized}
            />
            {/* todo: find a way to make some tooltip work with the minimized graphs! */}
            {!minimized && (
              <Tooltip
                cursor={{ fill: chartHoverFill }}
                wrapperStyle={{ outline: "none" }}
                labelFormatter={(value) => dayjs(value).format("MMM D, YYYY")}
                formatter={(value: number, payload) => {
                  // The type cast is unfortunately necessary, due to broken typing in recharts.
                  // What we return is a [string, string], and the library accepts this as well, but the types
                  // require the first element to be of the same type as value, which isn't what the formatter
                  // is supposed to do: https://github.com/recharts/recharts/issues/3008

                  const formattedNumber =
                    value < 0.005 && value > 0
                      ? "<0.01"
                      : formatNumber(value, { maximumFractionDigits: 2, minimumFractionDigits: 2 });

                  return [
                    formattedNumber,
                    formatMessage({
                      id: `credits.${payload}`,
                    }),
                  ] as unknown as [number, string];
                }}
              />
            )}
            <Bar key="paid" stackId="a" dataKey="billedCost" fill={styles.grey}>
              {chartData.map((item, index) => {
                return (
                  <Cell
                    key={`cell-paid-${index}`}
                    // recharts takes an array here, but their types only permit a string or number :/
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore-next-line
                    radius={
                      item.freeUsage && item.freeUsage / (item.freeUsage + item.billedCost) > 0.01 ? 0 : [4, 4, 0, 0]
                    }
                  />
                );
              })}
            </Bar>
            {isEnrolledInFreeConnectorProgram && (
              <Bar key="free" stackId="a" dataKey="freeUsage" fill={styles.green} radius={[4, 4, 0, 0]}>
                {chartData.map((item, index) => {
                  return item.freeUsage && item.freeUsage / (item.freeUsage + item.billedCost) < 0.01 ? (
                    <Cell key={`cell-free-${index}`} width={0} />
                  ) : (
                    <Cell key={`cell-free-${index}`} />
                  );
                })}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <FlexContainer alignItems="center" justifyContent="center" className={styles.empty}>
          <EmptyState />
        </FlexContainer>
      )}
    </div>
  );
};