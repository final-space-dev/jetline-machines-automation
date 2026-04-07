import { NextResponse } from "next/server";

const DAGSTER_URL = "http://172.20.246.163:3000/graphql";

const QUERY = `{
  runsOrError(filter: {pipelineName: "xerox_meters_job"}, limit: 1) {
    ... on Runs {
      results {
        runId
        status
        startTime
        endTime
      }
    }
    ... on PythonError {
      message
    }
  }
}`;

export async function GET() {
  try {
    const res = await fetch(DAGSTER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: QUERY }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error(`Dagster HTTP ${res.status}`);

    const json = await res.json() as {
      data?: {
        runsOrError?: {
          results?: { runId: string; status: string; startTime: number; endTime: number }[];
          message?: string;
        };
      };
      errors?: { message: string }[];
    };

    if (json.errors?.length) throw new Error(json.errors[0].message);

    const results = json.data?.runsOrError?.results;
    if (!results || results.length === 0) {
      return NextResponse.json({ found: false });
    }

    const run = results[0];
    return NextResponse.json({
      found: true,
      status: run.status,
      startTime: run.startTime,
      endTime: run.endTime,
      runId: run.runId,
    });
  } catch (err) {
    return NextResponse.json({ found: false, error: String(err) });
  }
}
