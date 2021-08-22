import Entity from "../Entity"
import {isInDiscord} from "../discord/inDiscord"
import {sendStaffNotfication} from "../../http/log"

export default class Management extends Entity {
    constructor(db, app, api) {
        super(db, app, api)
    }

    hire = async (req, res) => {
        isInDiscord(req.body.discord, req.body.company).then((inDiscord) => {
            if (!inDiscord) return this.errorResponse(res, "Member not in Discord")
            const deadline = new Date(new Date().getTime() + 14 * 24 * 60 * 60 * 1000);

            this.db.members.findOne({where: {in_game_id: req.body.member}}).then(async (result) => {
                if (!result) {
                    const t = await this.db.sequelize.transaction();

                    this.db.members.create({
                        in_game_id: req.body.member,
                        discord_id: this.db.sequelize.escape(req.body.discord).slice(1, -1),
                        in_game_name: this.db.sequelize.escape(req.body.name).slice(1, -1),
                        company: req.body.company.toLowerCase(),
                        deadline: deadline.toISOString().split('T')[0],
                        last_turnin: new Date().toISOString().split('T')[0],
                        rts: {
                            vouchers: 0,
                            worth: 0
                        },
                        pigs: {
                            vouchers: 0,
                            worth: 0
                        }
                    }, {
                        include: [
                            {model: this.db.rts, as: 'rts'},
                            {model: this.db.pigs, as: 'pigs'}
                        ],
                        transaction: t
                    }).then(async () => {
                        if (req.body.app_id) {
                            await this.db.applications.update({status: 'Hired', status_info: null}, {
                                where: {
                                    id: req.body.app_id
                                },
                                transaction: t
                            })
                        }

                        sendStaffNotfication(`<@${req.user.id}> AKA **${req.body.name}** (**${req.body.member}**) was rehired to **${req.body.company.toUpperCase()}**!`)

                        this.api.Alfred.refreshRoles(req.body.discord, "447157938390433792")
                        this.api.Alfred.refreshRoles(req.body.discord, "487285826544205845")

                        this.api.Alfred.sendHireMessage(req.body.discord, req.body.name)

                        this.successResponse(res)

                        t.commit();
                        console.log("COMMIT");
                    }).catch((err) => {
                        console.log("ROLLBACK");
                        t.rollback();
                        console.error(err);
                        this.errorResponse(res, err)
                    })
                } else {

                    result.in_game_id = req.body.member;
                    result.discord_id = this.db.sequelize.escape(req.body.discord).slice(1, -1);
                    result.in_game_name = this.db.sequelize.escape(req.body.name).slice(1, -1);
                    result.deadline = deadline.toISOString().split('T')[0]
                    result.fire_reason = null;
                    result.company = req.body.company.toLowerCase();
                    result.last_turnin = new Date().toISOString().split('T')[0]
                    result.save();

                    if (req.body.member == req.user.in_game_id) {
                        sendStaffNotfication(`<@${req.user.id}> AKA **${req.body.name}** (**${req.body.member}**) was rehired to **${req.body.company.toUpperCase()}**!`)
                    }

                    this.Alfred.refreshRoles(req.body.discord, "447157938390433792")
                    this.Alfred.refreshRoles(req.body.discord, "487285826544205845")

                    this.successResponse(res);
                }
            }).catch((err) => {
                console.error(err);
                this.errorResponse(res, err)
            })
        }).catch((err) => {
            console.error(err);
            this.errorResponse(res, err)
        })
    }
}