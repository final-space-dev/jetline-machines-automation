declare module "@imc-trading/react-pivottable" {
  import { ComponentType } from "react";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const PivotTableUI: ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const PivotTable: ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const TableRenderers: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const aggregators: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const aggregatorTemplates: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const derivers: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const locales: any;
  export const naturalSort: (a: string, b: string) => number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const numberFormat: any;
  export const sortAs: (order: string[]) => (a: string, b: string) => number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const getSort: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const createPlotlyRenderers: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export class PivotData {
    constructor(props: any);
  }
}

declare module "@imc-trading/react-pivottable/pivottable.css";
