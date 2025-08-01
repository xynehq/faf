/**
 * FAF ADK Layer - Integration Tests
 */

import {
  createAgent,
  createSimpleAgent,
  createMultiAgent,
  createFunctionTool,
  createEchoTool,
  createCalculatorTool,
  createInMemorySessionProvider,
  createRunnerConfig,
  runAgent,
  runAgentStream,
  createUserMessage,
  createModelMessage,
  getTextContent,
  quickSetup,
  createQuickWeatherAgent,
  createQuickChatAgent,
  Model,
  ToolParameterType,
  AgentEvent
} from '../index';

import { streamToArray } from '../streaming';

describe('ADK Layer Integration', () => {
  describe('End-to-End Agent Workflows', () => {
    test('should create and run a complete agent workflow', async () => {
      // Create tools
      const greetingTool = createFunctionTool({
        name: 'greet',
        description: 'Generate a greeting',
        execute: (params) => {
          const typedParams = params as { name: string };
          return `Hello, ${typedParams.name}! Welcome to FAF ADK!`;
        },
        parameters: [
          {
            name: 'name',
            type: ToolParameterType.STRING,
            description: 'Name to greet',
            required: true
          }
        ]
      });

      const calculatorTool = createCalculatorTool();

      // Create agent
      const agent = createAgent({
        name: 'integration_agent',
        model: Model.GEMINI_2_0_FLASH,
        instruction: 'You are a helpful assistant that can greet users and perform calculations',
        tools: [greetingTool, calculatorTool]
      });

      // Create session provider and runner
      const sessionProvider = createInMemorySessionProvider();
      const runnerConfig = createRunnerConfig(agent, sessionProvider);

      // Test greeting
      const greetingMessage = createUserMessage('Please greet me, my name is Alice');
      const greetingResponse = await runAgent(
        runnerConfig,
        { userId: 'user_123' },
        greetingMessage
      );

      expect(greetingResponse.content).toBeDefined();
      expect(greetingResponse.session.messages).toContain(greetingMessage);
      expect(greetingResponse.metadata.agentId).toBe(agent.id);

      // Test calculation in same session
      const calcMessage = createUserMessage('What is 25 * 4?');
      const calcResponse = await runAgent(
        runnerConfig,
        { userId: 'user_123', sessionId: greetingResponse.session.id },
        calcMessage
      );

      expect(calcResponse.content).toBeDefined();
      expect(calcResponse.session.id).toBe(greetingResponse.session.id);
      expect(calcResponse.session.messages.length).toBeGreaterThan(2);
    });

    test('should handle streaming agent interactions', async () => {
      const { run, stream } = quickSetup(
        'streaming_test_agent',
        Model.GEMINI_2_0_FLASH,
        'You are a storytelling agent that provides engaging narratives',
        [createEchoTool()]
      );

      // Test regular execution
      const message = createUserMessage('Tell me a short story');
      const response = await run({ userId: 'user_123' }, message);
      
      expect(response.content).toBeDefined();
      expect(getTextContent(response.content)).toBeTruthy();

      // Test streaming execution
      const streamingEvents = stream({ userId: 'user_123' }, message);
      const events = await streamToArray<AgentEvent>(streamingEvents);
      
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('message_start');
    });

    test('should handle multi-agent coordination', async () => {
      // Create specialized agents
      const weatherAgent = createAgent({
        name: 'weather_specialist',
        model: Model.GEMINI_2_0_FLASH,
        instruction: 'Provide weather information',
        tools: [createFunctionTool({
          name: 'get_weather',
          description: 'Get weather data',
          execute: (params) => {
            const typedParams = params as { location: string };
            return {
              location: typedParams.location,
              temperature: 22,
              condition: 'sunny',
              humidity: 60
            };
          },
          parameters: [{ name: 'location', type: ToolParameterType.STRING, description: 'Location', required: true }]
        })]
      });

      const mathAgent = createAgent({
        name: 'math_specialist', 
        model: Model.GEMINI_2_0_FLASH,
        instruction: 'Perform mathematical calculations',
        tools: [createCalculatorTool()]
      });

      // Create coordinator
      const coordinator = createMultiAgent(
        'smart_coordinator',
        Model.GEMINI_2_0_FLASH,
        'Coordinate between weather and math specialists based on user requests',
        [weatherAgent.config, mathAgent.config],
        'conditional'
      );

      const sessionProvider = createInMemorySessionProvider();
      const runnerConfig = createRunnerConfig(coordinator, sessionProvider);

      // Test weather delegation
      const weatherMessage = createUserMessage('What\'s the weather in Tokyo?');
      const weatherResponse = await runAgent(
        runnerConfig,
        { userId: 'user_123' },
        weatherMessage
      );

      expect(weatherResponse.content).toBeDefined();

      // Test math delegation  
      const mathMessage = createUserMessage('Calculate 15 + 27');
      const mathResponse = await runAgent(
        runnerConfig,
        { userId: 'user_123', sessionId: weatherResponse.session.id },
        mathMessage
      );

      expect(mathResponse.content).toBeDefined();
    });
  });

  describe('Quick Setup Utilities', () => {
    test('should create weather agent using quick setup', async () => {
      const { agent, run } = createQuickWeatherAgent();
      
      expect(agent.config.name).toBe('weather_agent');
      expect(agent.config.tools.length).toBeGreaterThan(0);

      const message = createUserMessage('What\'s the weather like?');
      const response = await run({ userId: 'user_123' }, message);
      
      expect(response.content).toBeDefined();
    });

    test('should create chat agent using quick setup', async () => {
      const { agent, run } = createQuickChatAgent();
      
      expect(agent.config.name).toBe('chat_agent');
      expect(agent.config.tools.length).toBeGreaterThan(0);

      const message = createUserMessage('What is 50 / 2?');
      const response = await run({ userId: 'user_123' }, message);
      
      expect(response.content).toBeDefined();
    });
  });

  describe('Session Persistence', () => {
    test('should maintain conversation history across multiple interactions', async () => {
      const agent = createSimpleAgent(
        'persistent_agent',
        Model.GEMINI_2_0_FLASH,
        'Remember our conversation history',
        []
      );

      const sessionProvider = createInMemorySessionProvider();
      const runnerConfig = createRunnerConfig(agent, sessionProvider);

      const context = { userId: 'user_123' };

      // First interaction
      const message1 = createUserMessage('My name is Bob');
      const response1 = await runAgent(runnerConfig, context, message1);
      
      expect(response1.session.messages).toHaveLength(2); // user + model message

      // Second interaction with same session
      const message2 = createUserMessage('What did I tell you my name was?');
      const response2 = await runAgent(
        runnerConfig,
        { ...context, sessionId: response1.session.id },
        message2
      );

      expect(response2.session.messages).toHaveLength(4); // Previous 2 + new 2
      expect(response2.session.id).toBe(response1.session.id);
    });

    test('should handle multiple users with separate sessions', async () => {
      const agent = createSimpleAgent(
        'multi_user_agent',
        Model.GEMINI_2_0_FLASH,
        'Handle multiple users',
        []
      );

      const sessionProvider = createInMemorySessionProvider();
      const runnerConfig = createRunnerConfig(agent, sessionProvider);

      // User 1 interaction
      const user1Message = createUserMessage('I am user 1');
      const user1Response = await runAgent(
        runnerConfig,
        { userId: 'user_1' },
        user1Message
      );

      // User 2 interaction
      const user2Message = createUserMessage('I am user 2');
      const user2Response = await runAgent(
        runnerConfig,
        { userId: 'user_2' },
        user2Message
      );

      expect(user1Response.session.id).not.toBe(user2Response.session.id);
      expect(user1Response.session.userId).toBe('user_1');
      expect(user2Response.session.userId).toBe('user_2');
    });
  });

  describe('Tool Integration', () => {
    test('should handle complex tool interactions', async () => {
      const dataProcessingTool = createFunctionTool({
        name: 'process_data',
        description: 'Process and analyze data',
        execute: (params, context) => {
          const typedParams = params as { data: number[]; operation: string };
          const { data, operation } = typedParams;
          switch (operation) {
            case 'sum':
              return { result: data.reduce((a, b) => a + b, 0), operation };
            case 'average':
              return { result: data.reduce((a, b) => a + b, 0) / data.length, operation };
            case 'max':
              return { result: Math.max(...data), operation };
            case 'min':
              return { result: Math.min(...data), operation };
            default:
              throw new Error(`Unknown operation: ${operation}`);
          }
        },
        parameters: [
          {
            name: 'data',
            type: ToolParameterType.ARRAY,
            description: 'Array of numbers to process',
            required: true
          },
          {
            name: 'operation',
            type: ToolParameterType.STRING,
            description: 'Operation to perform (sum, average, max, min)',
            required: true
          }
        ]
      });

      const agent = createAgent({
        name: 'data_agent',
        model: Model.GEMINI_2_0_FLASH,
        instruction: 'Help users process and analyze numerical data',
        tools: [dataProcessingTool]
      });

      const sessionProvider = createInMemorySessionProvider();
      const runnerConfig = createRunnerConfig(agent, sessionProvider);

      const message = createUserMessage('Calculate the sum of these numbers: 10, 20, 30, 40, 50');
      const response = await runAgent(
        runnerConfig,
        { userId: 'user_123' },
        message
      );

      expect(response.content).toBeDefined();
      expect(response.toolCalls.length).toBeGreaterThan(0);
      expect(response.toolResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle tool execution errors gracefully', async () => {
      const errorTool = createFunctionTool({
        name: 'error_tool',
        description: 'A tool that sometimes fails',
        execute: (params, context) => {
          const typedParams = params as { shouldFail: boolean };
          if (typedParams.shouldFail) {
            throw new Error('Tool execution failed');
          }
          return { success: true };
        },
        parameters: [
          {
            name: 'shouldFail',
            type: ToolParameterType.BOOLEAN,
            description: 'Whether the tool should fail',
            required: true
          }
        ]
      });

      const agent = createAgent({
        name: 'error_handling_agent',
        model: Model.GEMINI_2_0_FLASH,
        instruction: 'Handle tool errors gracefully',
        tools: [errorTool]
      });

      const sessionProvider = createInMemorySessionProvider();
      const runnerConfig = createRunnerConfig(agent, sessionProvider);

      // Test successful tool execution
      const successMessage = createUserMessage('Execute tool with success');
      const successResponse = await runAgent(
        runnerConfig,
        { userId: 'user_123' },
        successMessage
      );

      expect(successResponse.content).toBeDefined();

      // Test failed tool execution
      const failMessage = createUserMessage('Execute tool with failure');
      const failResponse = await runAgent(
        runnerConfig,
        { userId: 'user_123', sessionId: successResponse.session.id },
        failMessage
      );

      expect(failResponse.content).toBeDefined();
      // Should have tool responses with errors
      expect(failResponse.toolResponses.some(r => !r.success)).toBeTruthy();
    });

    test('should handle agent execution errors', async () => {
      const problematicAgent = createAgent({
        name: 'problematic_agent',
        model: 'invalid_model',
        instruction: 'This agent will cause issues',
        tools: []
      });

      const sessionProvider = createInMemorySessionProvider();
      const runnerConfig = createRunnerConfig(problematicAgent, sessionProvider);

      const message = createUserMessage('Try to execute');
      
      await expect(runAgent(runnerConfig, { userId: 'user_123' }, message))
        .rejects.toThrow();
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle multiple concurrent agent executions', async () => {
      const agent = createSimpleAgent(
        'concurrent_agent',
        Model.GEMINI_2_0_FLASH,
        'Handle concurrent requests',
        [createEchoTool()]
      );

      const sessionProvider = createInMemorySessionProvider();
      const runnerConfig = createRunnerConfig(agent, sessionProvider);

      // Create multiple concurrent requests
      const promises = Array.from({ length: 5 }, (_, i) =>
        runAgent(
          runnerConfig,
          { userId: `user_${i}` },
          createUserMessage(`Concurrent request ${i}`)
        )
      );

      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(5);
      responses.forEach((response, i) => {
        expect(response.content).toBeDefined();
        expect(response.session.userId).toBe(`user_${i}`);
      });
    });

    test('should handle large conversation histories', async () => {
      const agent = createSimpleAgent(
        'history_agent',
        Model.GEMINI_2_0_FLASH,
        'Handle large conversation histories',
        []
      );

      const sessionProvider = createInMemorySessionProvider();
      const runnerConfig = createRunnerConfig(agent, sessionProvider);

      let currentSession: any = null;

      // Build up a large conversation history
      for (let i = 0; i < 20; i++) {
        const message = createUserMessage(`Message number ${i + 1}`);
        const response = await runAgent(
          runnerConfig,
          {
            userId: 'user_123',
            sessionId: currentSession?.id
          },
          message
        );

        currentSession = response.session;
        expect(response.session.messages.length).toBe((i + 1) * 2);
      }

      // Final session should have 40 messages (20 user + 20 model)
      expect(currentSession.messages).toHaveLength(40);
    });
  });

  describe('Complex Scenarios', () => {
    test('should handle agent delegation and transfer', async () => {
      const transferTool = createFunctionTool({
        name: 'transfer_request',
        description: 'Transfer to specialist agent',
        execute: (params, context) => {
          const typedParams = params as { targetAgent: string };
          if (context.actions) {
            context.actions.transferToAgent = typedParams.targetAgent;
          }
          return { transferred: true, target: typedParams.targetAgent };
        },
        parameters: [
          {
            name: 'targetAgent',
            type: ToolParameterType.STRING,
            description: 'Name of target agent',
            required: true
          }
        ]
      });

      const specialistAgent = createAgent({
        name: 'specialist',
        model: Model.GEMINI_2_0_FLASH,
        instruction: 'I am a specialist agent',
        tools: []
      });

      const coordinatorAgent = createMultiAgent(
        'coordinator',
        Model.GEMINI_2_0_FLASH,
        'Coordinate and transfer to specialists when needed',
        [specialistAgent.config],
        'conditional'
      );
      
      // Add the transfer tool
      coordinatorAgent.config.tools = [transferTool];

      const sessionProvider = createInMemorySessionProvider();
      const runnerConfig = createRunnerConfig(coordinatorAgent, sessionProvider);

      const message = createUserMessage('I need specialist help');
      const response = await runAgent(
        runnerConfig,
        { userId: 'user_123' },
        message
      );

      expect(response.content).toBeDefined();
    });

    test('should handle mixed content types and complex interactions', async () => {
      const multiModalTool = createFunctionTool({
        name: 'analyze_content',
        description: 'Analyze different types of content',
        execute: (params, context) => {
          const typedParams = params as { contentType: string; data: string };
          const { contentType, data } = typedParams;
          switch (contentType) {
            case 'text':
              return { type: 'text', length: data.length, words: data.split(' ').length };
            case 'url':
              return { type: 'url', domain: data.split('/')[2] || 'unknown' };
            case 'json':
              try {
                const parsed = JSON.parse(data);
                return { type: 'json', keys: Object.keys(parsed) };
              } catch {
                return { type: 'json', error: 'Invalid JSON' };
              }
            default:
              return { type: 'unknown', data };
          }
        },
        parameters: [
          {
            name: 'contentType',
            type: ToolParameterType.STRING,
            description: 'Type of content to analyze',
            required: true
          },
          {
            name: 'data',
            type: ToolParameterType.STRING,
            description: 'Content data to analyze',
            required: true
          }
        ]
      });

      const agent = createAgent({
        name: 'content_analyzer',
        model: Model.GEMINI_2_0_FLASH,
        instruction: 'Analyze various types of content provided by users',
        tools: [multiModalTool]
      });

      const sessionProvider = createInMemorySessionProvider();
      const runnerConfig = createRunnerConfig(agent, sessionProvider);

      // Test text analysis
      const textMessage = createUserMessage('Analyze this text: "Hello world from FAF ADK"');
      const textResponse = await runAgent(
        runnerConfig,
        { userId: 'user_123' },
        textMessage
      );

      expect(textResponse.content).toBeDefined();

      // Test JSON analysis
      const jsonMessage = createUserMessage('Analyze this JSON: {"name": "test", "value": 123}');
      const jsonResponse = await runAgent(
        runnerConfig,
        { userId: 'user_123', sessionId: textResponse.session.id },
        jsonMessage
      );

      expect(jsonResponse.content).toBeDefined();
      expect(jsonResponse.session.messages.length).toBeGreaterThan(2);
    });
  });
});