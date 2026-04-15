package com.futurepress.staticserver;

import java.io.IOException;

import fi.iki.elonen.NanoHTTPD;

public class BridgeWebServer extends NanoHTTPD {

  public interface RequestDelegate {
    Response onRequest(IHTTPSession session) throws Exception;
  }

  private final RequestDelegate delegate;

  public BridgeWebServer(String hostname, int port, RequestDelegate delegate) {
    super(hostname, port);
    this.delegate = delegate;
  }

  @Override
  public Response serve(IHTTPSession session) {
    try {
      return delegate.onRequest(session);
    } catch (Exception error) {
      return NanoHTTPD.newFixedLengthResponse(
          Response.Status.INTERNAL_ERROR,
          "application/json; charset=utf-8",
          "{\"code\":\"INVALID_REQUEST\",\"message\":\""
              + (error.getMessage() != null ? error.getMessage().replace("\"", "\\\"") : "Unexpected bridge failure.")
              + "\"}");
    }
  }
}
