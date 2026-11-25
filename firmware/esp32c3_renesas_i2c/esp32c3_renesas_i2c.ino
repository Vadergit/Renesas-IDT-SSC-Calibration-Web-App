// ESP32-C3, Arduino core. ZSC31014 I2C read-only laboratory bridge.
// External active-high load switch on GPIO10; never power SSC directly from GPIO.
// SDA/SCL require suitable external pull-ups and matching levels (max 3.3V at ESP32).
#include <Arduino.h>
#include <Wire.h>
constexpr int SDA_PIN=4,SCL_PIN=5,PWR_EN=10;
bool cm=false,powered=false; uint8_t activeAddr=0;
void ack(const String &s=""){Serial.print("<ACK>");if(s.length()){Serial.print(" ");Serial.print(s);}Serial.print("\r\n");}
void nack(const char *s){Serial.print("<NACK> ");Serial.print(s);Serial.print("\r\n");}
bool command(uint8_t a,uint8_t c){Wire.beginTransmission(a);Wire.write(c);Wire.write(0);Wire.write(0);return Wire.endTransmission()==0;}
bool readN(uint8_t a,uint8_t *buf,size_t n){if(Wire.requestFrom(a,n)!=n){while(Wire.available())Wire.read();return false;}for(size_t i=0;i<n;i++)buf[i]=Wire.read();return true;}
String bytes(const uint8_t *p,size_t n){const char *h="0123456789ABCDEF";String s;for(size_t i=0;i<n;i++){s+=h[p[i]>>4];s+=h[p[i]&15];}return s;}
void powerOff(){Wire.end();pinMode(SDA_PIN,INPUT);pinMode(SCL_PIN,INPUT);digitalWrite(PWR_EN,LOW);powered=false;cm=false;}
bool validAddr(const String &s,uint8_t &a){if(s.length()!=2)return false;for(int i=0;i<2;i++)if(!isxdigit(s[i]))return false;unsigned x=strtoul(s.c_str(),nullptr,16);if(x<8||x>119)return false;a=x;return true;}
void setup(){pinMode(PWR_EN,OUTPUT);digitalWrite(PWR_EN,LOW);Serial.begin(115200);Serial.setTimeout(200);}
void loop(){if(!Serial.available())return;String s=Serial.readStringUntil('\r');s.trim();if(s=="HELLO"){ack("RENESAS-I2C-1");return;}
 uint8_t a;int prefix=s.startsWith("DUMP")?4:s.startsWith("NOM")?3:2;if(!validAddr(s.substring(prefix),a)){nack("ADDRESS");return;}
 if(s.startsWith("CM")&&s.length()==4){powerOff();delay(50);Wire.begin(SDA_PIN,SCL_PIN,100000);Wire.setTimeOut(10);digitalWrite(PWR_EN,HIGH);powered=true; // timing must be verified on real hardware; no blind retries
 delayMicroseconds(500);if(!command(a,0xA0)){nack("START_CM");return;}delayMicroseconds(100);uint8_t b;if(!readN(a,&b,1)||b!=0x5A){nack("CM_ACK");return;}activeAddr=a;cm=true;ack("5A");return;}
 if(!powered||a!=activeAddr){nack("NOT_CONNECTED");return;}
 if(s.startsWith("DUMP")&&s.length()==6){if(!cm){nack("CM_REQUIRED");return;}uint8_t out[40];for(uint8_t i=0;i<20;i++){uint8_t b[3];if(!command(a,i)){nack("READ_CMD");return;}delayMicroseconds(100);if(!readN(a,b,3)||b[0]!=0x5A){nack("READ_ACK");return;}out[2*i]=b[1];out[2*i+1]=b[2];}ack(bytes(out,40));return;}
 if(s.startsWith("NOM")&&s.length()==5){if(!cm){nack("CM_REQUIRED");return;}cm=false;if(!command(a,0x80)){nack("NOM");return;}delay(25);ack();return;}
 if(s.startsWith("DF")&&s.length()==4){if(cm){nack("NOM_REQUIRED");return;}uint8_t b[4];if(!readN(a,b,4)){nack("DATA_FETCH");return;}ack(bytes(b,4));return;}
 nack("UNKNOWN_COMMAND");
}
