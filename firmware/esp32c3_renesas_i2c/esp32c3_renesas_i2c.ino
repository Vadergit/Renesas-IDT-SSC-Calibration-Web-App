// Experimental read-only Renesas I2C bridge, ESP32-C3 Arduino.
// External active-high load switch on GPIO10. Use switched pull-ups / appropriate level shifting.
#include <Arduino.h>
#include <Wire.h>
constexpr int SDA_PIN=4,SCL_PIN=5,PWR_EN=10;
enum Model { NONE, M14, M50, M150 };
Model active=NONE; bool cm=false,powered=false; uint8_t address=0;
void ack(const String &s=""){Serial.print("<ACK>");if(s.length()){Serial.print(" ");Serial.print(s);}Serial.print("\r\n");}
void nack(const char *s){Serial.print("<NACK> ");Serial.print(s);Serial.print("\r\n");}
bool tx(uint8_t a,uint8_t c,int n=0,uint16_t data=0){Wire.beginTransmission(a);Wire.write(c);if(n==1)Wire.write(uint8_t(data));if(n==2){Wire.write(uint8_t(data>>8));Wire.write(uint8_t(data));}return Wire.endTransmission()==0;}
bool rx(uint8_t a,uint8_t *b,size_t n){if(Wire.requestFrom(a,n)!=n){while(Wire.available())Wire.read();return false;}for(size_t i=0;i<n;i++)b[i]=Wire.read();return true;}
String hex(const uint8_t *p,size_t n){const char *h="0123456789ABCDEF";String s;for(size_t i=0;i<n;i++){s+=h[p[i]>>4];s+=h[p[i]&15];}return s;}
void powerOff(){if(powered)Wire.end();pinMode(SDA_PIN,INPUT);pinMode(SCL_PIN,INPUT);digitalWrite(PWR_EN,LOW);powered=false;cm=false;active=NONE;}
bool parseAddr(const String &s,uint8_t &a){if(s.length()!=2||!isxdigit(s[0])||!isxdigit(s[1]))return false;unsigned x=strtoul(s.c_str(),nullptr,16);if(x<8||x>120)return false;a=x;return true;}
bool checked150(uint8_t *b,uint8_t c){return b[3]==c&&uint8_t(b[0]+b[1]+b[2])==255;}
bool wordRead(uint8_t cmd,uint8_t *out){uint8_t b[4];if(!tx(address,cmd,active==M14?2:0))return false;delayMicroseconds(300);if(active==M14){if(!rx(address,b,3)||b[0]!=0x5a)return false;out[0]=b[1];out[1]=b[2];}else{if(!rx(address,b,active==M150?4:2))return false;if(active==M150&&!checked150(b,cmd))return false;out[0]=b[0];out[1]=b[1];}return true;}
bool rawWord(uint8_t cmd,uint8_t *out){uint8_t b[4];if(!tx(address,cmd))return false;delay(250);if(!rx(address,b,active==M150?4:2))return false;if(active==M150&&!checked150(b,cmd))return false;out[0]=b[0];out[1]=b[1];return true;}
void setup(){pinMode(PWR_EN,OUTPUT);digitalWrite(PWR_EN,LOW);Serial.begin(115200);Serial.setTimeout(200);}
void loop(){if(!Serial.available())return;String s=Serial.readStringUntil('\r');s.trim();if(s=="HELLO"){ack("RENESAS-I2C-2");return;}if(s=="OFF"){powerOff();ack();return;}
 if(s.startsWith("CM")&&s.length()==5){uint8_t a;char m=s[2];if(!parseAddr(s.substring(3),a)||(m!='A'&&m!='B'&&m!='C')||(m=='A'&&a==0x78)){nack("MODEL_ADDRESS");return;}powerOff();delay(50);if(!Wire.begin(SDA_PIN,SCL_PIN,100000)){nack("WIRE_INIT");return;}Wire.setTimeOut(20);digitalWrite(PWR_EN,HIGH);powered=true;active=m=='A'?M14:m=='B'?M50:M150;address=a;
 // First command after power-on must be START_CM on M14/M50.
 delayMicroseconds(active==M14?500:5000);
 uint8_t b[4];bool ok=false;
 if(active==M14){ok=tx(a,0xA0,2,0);delayMicroseconds(300);ok=ok&&rx(a,b,1)&&b[0]==0x5A;}
 if(active==M50){ok=tx(a,0x72);delayMicroseconds(300);ok=ok&&wordRead(0xCF,b)&&((b[0]!=0&&b[0]!=0xFF));}
 if(active==M150){ok=tx(a,0x72,1,0xD1);delayMicroseconds(300);ok=ok&&rx(a,b,4)&&checked150(b,0x72)&&b[0]==0xC3&&b[1]==0x72;}
 if(!ok){powerOff();nack("CM_RESPONSE");return;}cm=true;ack(active==M14?"5A":active==M50?"CM50":"C372");return;}
 if(!powered||active==NONE){nack("NOT_CONNECTED");return;}
 if(s=="DUMP"||s=="RAM"){bool ram=s=="RAM";if(!cm||(ram&&active==M14)){nack("MODE");return;}uint8_t count=active==M50?32:ram?15:20;uint8_t out[64];for(uint8_t i=0;i<count;i++){uint8_t cmd=active==M14?i:(ram?0x10:0x30)+i;if(!wordRead(cmd,out+2*i)){nack("WORD_READ");return;}}ack(hex(out,count*2));return;}
 if(s=="NOM"){if(!cm){nack("CM_REQUIRED");return;}bool ok=active==M14?tx(address,0x80,2):tx(address,active==M50?0x01:0x01);cm=false;if(!ok){nack("NOM");return;}delay(150);ack();return;}
 if(s=="DF"){if(cm||active!=M14){nack("MODE");return;}uint8_t b[4];if(!rx(address,b,4)){nack("DF");return;}if((b[0]>>6)==2){delay(150);if(!rx(address,b,4)){nack("DF");return;}}ack(hex(b,4));return;}
 if(s=="RAW"){if(!cm||active==M14){nack("MODE");return;}uint8_t out[4];if(!rawWord(0xD8,out)||!rawWord(0xD9,out+2)){nack("RAW");return;}ack(hex(out,4));return;}
 nack("UNKNOWN_COMMAND");
}
