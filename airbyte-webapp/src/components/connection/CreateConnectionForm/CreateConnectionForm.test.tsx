/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { act, render as tlr } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import selectEvent from "react-select-event";
import { VirtuosoMockContext } from "react-virtuoso";

import { mockConnection } from "test-utils/mock-data/mockConnection";
import {
  mockDestinationDefinition,
  mockDestinationDefinitionSpecification,
  mockDestinationDefinitionVersion,
} from "test-utils/mock-data/mockDestination";
import {
  mockSourceDefinition,
  mockSourceDefinitionSpecification,
  mockSourceDefinitionVersion,
} from "test-utils/mock-data/mockSource";
import { mockTheme } from "test-utils/mock-data/mockTheme";
import { TestWrapper, useMockIntersectionObserver } from "test-utils/testutils";

import { defaultOssFeatures, FeatureItem } from "core/services/features";
import * as sourceHook from "hooks/services/useSourceHook";

import { CreateConnectionForm } from "./CreateConnectionForm";

jest.mock("services/connector/SourceDefinitionService", () => ({
  useSourceDefinition: () => mockSourceDefinition,
}));

jest.mock("services/connector/DestinationDefinitionService", () => ({
  useDestinationDefinition: () => mockDestinationDefinition,
}));

jest.mock("area/workspace/utils", () => ({
  useCurrentWorkspaceId: () => "workspace-id",
}));

jest.mock("core/api", () => ({
  useCurrentWorkspace: () => ({}),
  useInvalidateWorkspaceStateQuery: () => () => null,
  useCreateConnection: () => async () => null,
  useSourceDefinitionVersion: () => mockSourceDefinitionVersion,
  useDestinationDefinitionVersion: () => mockDestinationDefinitionVersion,
  useGetSourceDefinitionSpecification: () => mockSourceDefinitionSpecification,
  useGetDestinationDefinitionSpecification: () => mockDestinationDefinitionSpecification,
}));

jest.mock("area/connector/utils", () => ({
  useGetSourceFromSearchParams: () => mockConnection.source,
  useGetDestinationFromSearchParams: () => mockConnection.destination,
  ConnectorIds: jest.requireActual("area/connector/utils").ConnectorIds,
}));

jest.mock("hooks/theme/useAirbyteTheme", () => ({
  useAirbyteTheme: () => mockTheme,
}));

jest.setTimeout(40000);

/**
 * TODO: remove the test file in 3rd PR of the cleanup
 * This one needs to be disabled because it will fail due to the default usage of the use hook form
 * @see CreateConnectionHookForm.test.tsx
 */
// eslint-disable-next-line jest/no-disabled-tests
describe.skip("CreateConnectionForm", () => {
  const Wrapper: React.FC<React.PropsWithChildren<unknown>> = ({ children }) => (
    <TestWrapper>
      <VirtuosoMockContext.Provider value={{ viewportHeight: 1000, itemHeight: 50 }}>
        {children}
      </VirtuosoMockContext.Provider>
    </TestWrapper>
  );
  const render = async () => {
    let renderResult: ReturnType<typeof tlr>;

    await act(async () => {
      renderResult = tlr(
        <Wrapper>
          <CreateConnectionForm />
        </Wrapper>
      );
    });
    return renderResult!;
  };

  const baseUseDiscoverSchema = {
    schemaErrorStatus: null,
    isLoading: false,
    schema: mockConnection.syncCatalog,
    catalogId: "",
    onDiscoverSchema: () => Promise.resolve(),
  };

  beforeEach(() => {
    useMockIntersectionObserver();
  });

  it("should render", async () => {
    jest.spyOn(sourceHook, "useDiscoverSchema").mockImplementationOnce(() => baseUseDiscoverSchema);
    const renderResult = await render();
    expect(renderResult).toMatchSnapshot();
    expect(renderResult.queryByText("Please wait a little bit more…")).toBeFalsy();
  });

  it("should render when loading", async () => {
    jest
      .spyOn(sourceHook, "useDiscoverSchema")
      .mockImplementationOnce(() => ({ ...baseUseDiscoverSchema, isLoading: true }));

    const renderResult = await render();
    expect(renderResult).toMatchSnapshot();
  });

  it("should render with an error", async () => {
    jest.spyOn(sourceHook, "useDiscoverSchema").mockImplementationOnce(() => ({
      ...baseUseDiscoverSchema,
      schemaErrorStatus: new Error("Test Error") as sourceHook.SchemaError,
    }));

    const renderResult = await render();
    expect(renderResult).toMatchSnapshot();
  });

  describe("cron expression validation", () => {
    const INVALID_CRON_EXPRESSION = "invalid cron expression";
    const CRON_EXPRESSION_EVERY_MINUTE = "* * * * * * ?";

    it("should display an error for an invalid cron expression", async () => {
      jest.spyOn(sourceHook, "useDiscoverSchema").mockImplementationOnce(() => baseUseDiscoverSchema);

      const container = tlr(
        <TestWrapper>
          <CreateConnectionForm />
        </TestWrapper>
      );

      await selectEvent.select(container.getByTestId("scheduleData"), /cron/i);

      const cronExpressionInput = container.getByTestId("cronExpression");

      await userEvent.clear(cronExpressionInput);
      await userEvent.type(cronExpressionInput, INVALID_CRON_EXPRESSION, { delay: 1 });

      const errorMessage = container.getByText(/must contain at least 6 fields/);

      expect(errorMessage).toBeInTheDocument();
    });

    it("should allow cron expressions under one hour when feature enabled", async () => {
      jest.spyOn(sourceHook, "useDiscoverSchema").mockImplementationOnce(() => baseUseDiscoverSchema);

      const container = tlr(
        <TestWrapper>
          <CreateConnectionForm />
        </TestWrapper>
      );

      await selectEvent.select(container.getByTestId("scheduleData"), /cron/i);

      const cronExpressionField = container.getByTestId("cronExpression");

      await userEvent.clear(cronExpressionField);
      await userEvent.type(cronExpressionField, CRON_EXPRESSION_EVERY_MINUTE, { delay: 1 });

      const errorMessage = container.queryByTestId("cronExpressionError");

      expect(errorMessage).not.toBeInTheDocument();
    });

    it("should not allow cron expressions under one hour when feature not enabled", async () => {
      jest.spyOn(sourceHook, "useDiscoverSchema").mockImplementationOnce(() => baseUseDiscoverSchema);

      const featuresToInject = defaultOssFeatures.filter((f) => f !== FeatureItem.AllowSyncSubOneHourCronExpressions);

      const container = tlr(
        <TestWrapper features={featuresToInject}>
          <CreateConnectionForm />
        </TestWrapper>
      );

      await selectEvent.select(container.getByTestId("scheduleData"), /cron/i);

      const cronExpressionField = container.getByTestId("cronExpression");

      await userEvent.clear(cronExpressionField);
      await userEvent.type(cronExpressionField, CRON_EXPRESSION_EVERY_MINUTE, { delay: 1 });

      const errorMessage = container.getByTestId("cronExpressionError");

      expect(errorMessage).toBeInTheDocument();
    });
  });
});
