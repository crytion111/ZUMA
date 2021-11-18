// Learn TypeScript:
//  - https://docs.cocos.com/creator/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/manual/en/scripting/life-cycle-callbacks.html



//关卡读取和控制

import Ball from "./Ball";
import {izx} from "../../framework/izx";

const {ccclass, property} = cc._decorator;

@ccclass
export default class Level_Ctrl{

    actionLists = []
    pointsArr = []
    allLength = 0;
    allTime = 0;

    // 存下球每帧经过的点,,连起来就是轨迹
    ballFramePointArr:cc.Vec3[] = [];

    posLevelBegin:cc.Vec3 = null;

    //todo 可以传参数来确定加载什么关卡,
    start (nLevelNum)
    {
        this.actionLists = [];
        this.pointsArr = [];

        let bundle = cc.assetManager.getBundle("zuma")
        bundle.load("config/level_"+nLevelNum, cc.JsonAsset, (err, jsonAsset:cc.JsonAsset) =>
        {
            if(err)
            {
                cc.error("轨迹文件加载失败!!!!!!!!!!!!!!!!" + err);
                return;
            }

            let config = jsonAsset.json;
            this.pointsArr = config.points;
            this.allLength = config.length;
            this.allTime = config.time;

            this.posLevelBegin = cc.v3(this.pointsArr[0].x, this.pointsArr[0].y)
            this.setFramePoint();
            izx.dispatchEvent("level_config_load_finish");
        })
    }


    setFramePoint()
    {
        let gameFrame = cc.game.getFrameRate();
        this.ballFramePointArr = [];

        for (let i = 1; i < this.pointsArr.length; i++)
        {
            // 整个轨迹运行完毕需要nAllPathFrame帧
            let nAllPathFrame = Math.floor(this.allLength / this.allTime) * gameFrame;
            //每帧走多少路
            let fPerFrameLength = this.allLength / (gameFrame * this.allTime);

            //         局部长度除以全局速度=局部时间    全部长度除以全部时间=全局速度
            let time = this.pointsArr[i].length / (this.allLength / this.allTime);

            // 从上个点到这个点需要时间
            let fOneActTime = this.pointsArr[i].time;
            if(fOneActTime == 0)
            {
                continue;
            }

            // 这就是上个点到这个点需要几帧
            let fNeedFrame = Math.ceil(time * gameFrame);
            // 每帧走的距离
            let fPerX = (this.pointsArr[i].x - this.pointsArr[i - 1].x) / fNeedFrame;
            let fPerY = (this.pointsArr[i].y - this.pointsArr[i - 1].y) / fNeedFrame;

            // cc.log("asdjhadsjajdh===>fPerX==>" + fPerX+"  fPerY==>"+fPerY, "  aksjak=>" + cc.v3(fPerX, fPerY).mag())
            if(isNaN(fPerX))
            {
                cc.error("asdadasads==== "+fNeedFrame, fOneActTime, gameFrame)
            }

            let lastPointX = this.pointsArr[i - 1].x;
            let lastPointY = this.pointsArr[i - 1].y;
            for (let j = 0; j < fNeedFrame; j++)
            {
                this.ballFramePointArr.push(cc.v3(lastPointX, lastPointY))
                lastPointX += fPerX
                lastPointY += fPerY
            }
        }
        // cc.log("+>>>>>>>>/n" + this.ballFramePointArr);
        //
        // let asdad = "";
        // for (let i = 0; i < this.ballFramePointArr.length - 2; i++)
        // {
        //     let aaa = this.ballFramePointArr[i];
        //     let bbb = this.ballFramePointArr[i+1];
        //
        //     let ddd = aaa.sub(bbb).mag();
        //     asdad += (ddd + " ")
        // }

        // cc.error("asdjhadsjajdh===>/n" + asdad)
    }


    setBallActionList(ball:Ball, nIndex)
    {
        if(this.ballFramePointArr.length <= 0)
        {
            console.error("轨迹文件没加载好!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
            return;
        }
        ball.setBallActList(nIndex);
    }

    insertBallToActionList(ball:Ball, nIndex)
    {
        if(this.ballFramePointArr.length <= 0)
        {
            console.error("轨迹文件没加载好!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
            return;
        }
        ball.insertBallSetAction(nIndex);
    }

    // update (dt) {}
}
