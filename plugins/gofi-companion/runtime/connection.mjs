// Fallback is restricted to opening a transport. Once a caller receives the
// client, tool failures are returned unchanged and can never replay a write.
export async function openTransport(mode, connect) {
  if (mode !== 'auto') {
    if (!['cli', 'mcp'].includes(mode)) throw new Error('GOFI_UTCP_TRANSPORT must be auto, cli or mcp');
    return connect(mode);
  }
  try { return await connect('mcp'); }
  catch {
    try { return await connect('cli'); }
    catch { throw new Error('Neither GoFi MCP nor CLI transport could connect. Check Node 22/24 and dependencies on the connected host; no download was started'); }
  }
}
