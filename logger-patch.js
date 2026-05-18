function timestampPrefix() {
  const timestamp = new Date().toLocaleTimeString([], { hour12: false });
  return `\x1b[90m[${timestamp}]\x1b[0m `;
}

function patchStream(stream) {
  const originalWrite = stream.write.bind(stream);
  let needsPrefix = true;

  stream.write = function timestampedWrite(chunk, encoding, callback) {
    if (typeof chunk !== "string" && !Buffer.isBuffer(chunk)) {
      return originalWrite(chunk, encoding, callback);
    }

    const text = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk;
    let output = "";

    for (const char of text) {
      if (needsPrefix && char !== "\n" && char !== "\r") {
        output += timestampPrefix();
        needsPrefix = false;
      }

      output += char;

      if (char === "\n" || char === "\r") {
        needsPrefix = true;
      }
    }

    return originalWrite(output, encoding, callback);
  };
}

patchStream(process.stdout);
patchStream(process.stderr);
