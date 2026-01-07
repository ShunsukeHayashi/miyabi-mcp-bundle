#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["mcp>=1.0.0", "pydantic"]
# ///
"""
Hello World MCP Server
シンプルなローカルMCPサーバーの例
"""

from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, Field
from typing import Optional

# MCPサーバーの初期化
mcp = FastMCP("hello_mcp")


class HelloInput(BaseModel):
    """Hello Worldツールの入力モデル"""
    name: Optional[str] = Field(
        default=None,
        description="挨拶する相手の名前（省略可能）"
    )


@mcp.tool(
    name="hello_world",
    annotations={
        "title": "Hello World",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False
    }
)
async def hello_world(params: HelloInput) -> str:
    """シンプルなHello Worldを返すツール
    
    名前が指定された場合はその名前で挨拶し、
    指定されなければ「Hello, World!」を返します。
    
    Args:
        params (HelloInput): 入力パラメータ
            - name (Optional[str]): 挨拶する相手の名前
    
    Returns:
        str: 挨拶メッセージ
    """
    if params.name:
        return f"Hello, {params.name}!"
    return "Hello, World!"


@mcp.tool(
    name="greet",
    annotations={
        "title": "Greet",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False
    }
)
async def greet(message: str = "こんにちは") -> str:
    """カスタムメッセージで挨拶するツール
    
    Args:
        message (str): 挨拶メッセージ（デフォルト: こんにちは）
    
    Returns:
        str: 挨拶メッセージ
    """
    return f"🎉 {message}！MCPサーバーからの挨拶です！"


if __name__ == "__main__":
    # stdio トランスポートでローカル実行（デフォルト）
    mcp.run()
