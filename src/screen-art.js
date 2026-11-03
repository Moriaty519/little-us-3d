// An offline, code-drawn film still: long hair and ivory chiffon in motion.
export function drawDancingGirl(ctx,W,H){
  ctx.save();ctx.scale(W/768,H/432);
  const path=(d,fill)=>{ctx.fillStyle=fill;ctx.fill(new Path2D(d));};
  const background=ctx.createLinearGradient(0,0,768,432);background.addColorStop(0,'#81948b');background.addColorStop(.55,'#a5b0a2');background.addColorStop(1,'#768c82');ctx.fillStyle=background;ctx.fillRect(0,0,768,432);
  const light=ctx.createRadialGradient(414,112,12,390,191,325);light.addColorStop(0,'#f7f1dc90');light.addColorStop(.6,'#f2edda18');light.addColorStop(1,'#f2edda00');ctx.fillStyle=light;ctx.fillRect(0,0,768,432);
  path('M286 0H335L503 432H438Z','#f5f1db10');path('M477 0H498L319 432H258Z','#f5f1db0d');
  for(const [x,y,r]of [[130,97,46],[628,71,31],[667,288,52],[182,302,28]]){const glow=ctx.createRadialGradient(x,y,0,x,y,r);glow.addColorStop(0,'#faf3dd16');glow.addColorStop(1,'#faf3dd00');ctx.fillStyle=glow;ctx.fillRect(x-r,y-r,r*2,r*2);}
  ctx.save();ctx.filter='blur(9px)';ctx.fillStyle='#344c431c';ctx.beginPath();ctx.ellipse(424,371,100,7,0,0,Math.PI*2);ctx.fill();ctx.restore();
  // Bare feet extend beneath the moving hem.
  path('M424 267C423 289 425 316 420 343L415 358C419 365 438 370 448 367C444 362 435 361 432 356L436 328L444 280Z','#dfcbbb');
  path('M454 268C469 279 483 288 500 294L523 306C530 311 531 317 527 318C516 313 509 311 500 307L468 298L438 286Z','#d5bfad');
  // Neck and arms, with one hand reaching upward and one opening outward.
  path('M399 141L401 160L415 176L430 161L415 150L413 136Z','#ddc8b7');
  path('M410 172C390 174 370 164 354 151L333 127L315 101L306 87C302 82 299 84 301 90L304 103L317 123C327 140 336 157 353 170L390 194L421 189Z','#dec9b7');
  path('M426 169C447 168 467 178 488 171L519 155L538 136L545 127C550 123 552 127 549 131L548 138L535 154C524 168 510 179 491 187L450 194L427 191Z','#e1cdbc');
  // A flowing blouse and generous sleeves follow the direction of the turn.
  const silk=ctx.createLinearGradient(353,173,497,318);silk.addColorStop(0,'#faf8eb');silk.addColorStop(.55,'#eeeedd');silk.addColorStop(1,'#ced9cf');
  path('M402 157C412 152 427 157 433 168L446 195L448 218L426 229L405 206L395 177Z',silk);
  path('M406 170C390 173 376 165 362 157L344 150C348 167 369 184 371 200C393 199 409 189 414 184Z','#f5f4e5');
  path('M428 172C445 169 463 176 480 173L498 167C498 180 480 189 478 207C455 203 439 194 430 188Z','#f6f5e7');
  // Chiffon fans out around her; the translucent edges suggest a moving skirt.
  path('M429 210C455 211 472 223 491 237C514 252 546 259 574 257C558 278 540 286 545 303C518 302 496 289 479 294C455 306 451 327 430 336C416 315 409 290 386 293C359 296 341 315 310 312C325 295 318 280 291 270C328 268 354 251 379 232L413 214Z','#f2f1e3aa');
  path('M429 212C452 214 465 226 483 240C500 254 524 269 551 273C532 280 518 280 516 294C497 285 478 280 462 291C447 303 443 319 429 326C412 309 410 285 387 285C361 286 342 301 320 304C336 287 327 277 312 271C345 266 364 250 386 233L414 215Z',silk);
  path('M424 221C409 241 395 263 374 276C391 273 407 276 417 288C413 266 420 243 434 224Z','#c3d0c347');
  path('M438 220C447 242 446 262 439 279C458 266 479 268 498 280C472 258 459 235 447 221Z','#ffffff65');
  path('M419 219C391 233 370 253 341 267C374 259 395 244 426 227Z','#fffff23b');
  path('M450 224C477 240 513 269 547 269C519 272 490 254 465 243Z','#ffffff66');
  // Hair trails behind the turn; the face stays a quiet, featureless profile.
  path('M405 103C387 96 376 106 375 122C372 140 386 151 383 165C375 178 359 169 349 175C366 191 390 187 404 171C416 157 416 138 414 121Z','#43534d');
  path('M399 108C410 109 415 118 413 129L418 135L413 138C414 148 406 153 400 149L395 137L392 119Z','#e8d4c1');
  path('M396 105C401 100 411 104 415 116C413 125 411 130 413 137C407 132 405 121 403 116C396 121 392 127 390 138C383 131 382 117 389 110Z','#46564e');
  path('M382 136C392 154 389 171 373 180C394 179 404 165 404 153Z','#56655b');
  ctx.fillStyle='#fbf9e711';for(let i=0;i<360;i++){const x=(i*97.17)%768,y=(i*51.83)%432;ctx.fillRect(x,y,.6,.6);}
  ctx.restore();
}
