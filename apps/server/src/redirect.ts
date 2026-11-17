type Env = { readonly TARGET_ORIGIN: string };

export default {
  fetch(request: Request, env: Env): Response {
    const url = new URL(request.url);
    return Response.redirect(`${env.TARGET_ORIGIN}${url.pathname}${url.search}`, 301);
  },
} satisfies ExportedHandler<Env>;
