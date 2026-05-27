import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  // รับเฉพาะ HTTP POST ที่มาจาก LINE
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const body = await req.json();
    
    // วนลูปเช็ค Event ทั้งหมดที่ LINE ส่งมา
    if (body.events && body.events.length > 0) {
      for (const event of body.events) {
        
        // เช็คว่าแหล่งที่มาของ Event เป็น "กลุ่ม" หรือไม่
        if (event.source && event.source.type === 'group') {
          console.log("=========================================");
          console.log("🎉 แจ็คพอต! เจอ Group ID แล้ว คัดลอกค่าด้านล่างนี้ได้เลย:");
          console.log("Group ID : ", event.source.groupId);
          console.log("=========================================");
        }
        
      }
    }

    // ต้องตอบกลับสถานะ 200 OK เสมอ เพื่อให้ LINE รู้ว่าเรารับข้อมูลสำเร็จ
    return new Response('OK', { status: 200 });

  } catch (error) {
    console.error("Error:", error.message);
    return new Response('Internal Server Error', { status: 500 });
  }
});
