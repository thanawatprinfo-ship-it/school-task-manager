import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ดึงค่าตั้งค่าจาก Environment
const LINE_CLIENT_ID = Deno.env.get("LINE_CLIENT_ID");
const LINE_CLIENT_SECRET = Deno.env.get("LINE_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { code, redirectUri, userId } = await req.json();

    if (!code || !userId) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), { status: 400, headers: corsHeaders });
    }

    // 1. นำ Authorization Code ที่ได้มาแลก Access Token และ ID Token
    const tokenResponse = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
        client_id: LINE_CLIENT_ID,
        client_secret: LINE_CLIENT_SECRET,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
       return new Response(JSON.stringify({ error: tokenData.error_description }), { status: 400, headers: corsHeaders });
    }

    // 2. ถอดรหัส ID Token เพื่อดึง UserID และ รูปโปรไฟล์
    const verifyResponse = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        id_token: tokenData.id_token,
        client_id: LINE_CLIENT_ID,
      }),
    });

    const verifyData = await verifyResponse.json();
    const lineUserId = verifyData.sub;
    const pictureUrl = verifyData.picture || null; // <--- ดึงรูปโปรไฟล์มาตรงนี้

    // 3. บันทึกข้อมูลกลับลงไปในฐานข้อมูล Supabase
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { error: dbError } = await supabase
      .from('staff')
      .update({ 
         line_user_id: lineUserId,
         line_picture_url: pictureUrl // <--- เซฟรูปลงฐานข้อมูล
      })
      .eq('id', userId);

    if (dbError) throw dbError;

    return new Response(JSON.stringify({ success: true, lineUserId: lineUserId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});