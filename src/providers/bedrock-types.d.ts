// Ambient declarations for the optional AWS Bedrock SDK dependency.
// The real types come from @aws-sdk/client-bedrock-runtime when installed.
// This file just satisfies the TypeScript compiler when the package is absent.
declare module "@aws-sdk/client-bedrock-runtime" {
  export class BedrockRuntimeClient {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(config: any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    send(command: any, options?: any): Promise<any>;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export class ConverseCommand {
    constructor(input: any);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export class ConverseStreamCommand {
    constructor(input: any);
  }
}
